// Utilities
const Utils = require("../utilities/Utils.js");
const { impersonates, setupCoreProtocol, depositVault } = require("../utilities/hh-utils.js");

const addresses = require("../test-config.js");
const BigNumber = require("bignumber.js");
const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20");

const Strategy = artifacts.require("GammaMerklStrategyMainnet_QS_WBTC_ETH_w");

//This test was developed at blockNumber 54842550

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe("Mainnet Quickswap-Gamma WBTC-ETH wide", function() {
  let accounts;

  // external contracts
  let underlying;
  let quick;

  // external setup
  let underlyingWhale = "0x4E5ed30E3b4eB39ABCE3c150f31E180A3ae5806E";
  let quickWhale = "0x41dd65795c24273A3e3B910ea3e2D7866F5AFDDa";
  let quickAddr = "0xB5C064F955D8e7F38fE0460C556a72987494eE17";
  let weth = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
  let tbtc = "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b";

  // parties in the protocol
  let governance;
  let farmer1;

  // numbers used in tests
  let farmerBalance;

  // Core protocol contracts
  let controller;
  let vault;
  let strategy;

  async function setupExternalContracts() {
    underlying = await IERC20.at("0xadc7B4096C3059Ec578585Df36E6E1286d345367");
    quick = await IERC20.at(quickAddr);
    console.log("Fetching Underlying at: ", underlying.address);
  }

  async function setupBalance(){
    let etherGiver = accounts[9];
    // Give whale some ether to make sure the following actions are good
    await web3.eth.sendTransaction({ from: etherGiver, to: underlyingWhale, value: 100e18});
    await web3.eth.sendTransaction({ from: etherGiver, to: quickWhale, value: 100e18});

    farmerBalance = await underlying.balanceOf(underlyingWhale);
    await underlying.transfer(farmer1, farmerBalance, { from: underlyingWhale });
  }

  before(async function() {
    governance = addresses.Governance;
    accounts = await web3.eth.getAccounts();

    farmer1 = accounts[1];

    // impersonate accounts
    await impersonates([governance, underlyingWhale, quickWhale]);

    let etherGiver = accounts[9];
    await web3.eth.sendTransaction({ from: etherGiver, to: governance, value: 100e18});

    await setupExternalContracts();
    [controller, vault, strategy] = await setupCoreProtocol({
      "existingVaultAddress": null,
      "strategyArtifact": Strategy,
      "strategyArtifactIsUpgradable": true,
      "underlying": underlying,
      "governance": governance,
      "liquidation": [
        // {"quickswap": [quick, weth]},
        // {"uniV3": [weth, tbtc]},
      ],
    });

    // whale send underlying to farmers
    await setupBalance();
  });

  describe("Happy path", function() {
    it("Farmer should earn money", async function() {
      let farmerOldBalance = new BigNumber(await underlying.balanceOf(farmer1));
      console.log("Farmer old balance:", farmerOldBalance.toFixed());
      await depositVault(farmer1, underlying, vault, farmerBalance);
      let fTokenBalance = new BigNumber(await vault.balanceOf(farmer1));
      console.log("Farmer fToken balance:", fTokenBalance.toFixed());

      // Using half days is to simulate how we doHardwork in the real world
      let hours = 10;
      let blocksPerHour = 1565*5;
      let oldSharePrice;
      let newSharePrice;
      for (let i = 0; i < hours; i++) {
        console.log("loop ", i);

        await quick.transfer(strategy.address, new BigNumber(100e18), { from: quickWhale });

        oldSharePrice = new BigNumber(await vault.getPricePerFullShare());
        await controller.doHardWork(vault.address, { from: governance });
        newSharePrice = new BigNumber(await vault.getPricePerFullShare());

        console.log("old shareprice: ", oldSharePrice.toFixed());
        console.log("new shareprice: ", newSharePrice.toFixed());
        console.log("growth: ", newSharePrice.toFixed() / oldSharePrice.toFixed());

        apr = (newSharePrice.toFixed()/oldSharePrice.toFixed()-1)*(24/(blocksPerHour/1565))*365;
        apy = ((newSharePrice.toFixed()/oldSharePrice.toFixed()-1)*(24/(blocksPerHour/1565))+1)**365;

        console.log("instant APR:", apr*100, "%");
        console.log("instant APY:", (apy-1)*100, "%");

        await Utils.advanceNBlock(blocksPerHour);
      }
      await vault.withdraw(fTokenBalance, { from: farmer1 });
      let farmerNewBalance = new BigNumber(await underlying.balanceOf(farmer1));
      Utils.assertBNGt(farmerNewBalance, farmerOldBalance);

      apr = (farmerNewBalance.toFixed()/farmerOldBalance.toFixed()-1)*(24/(blocksPerHour*hours/1565))*365;
      apy = ((farmerNewBalance.toFixed()/farmerOldBalance.toFixed()-1)*(24/(blocksPerHour*hours/1565))+1)**365;

      console.log("earned!");
      console.log("Overall APR:", apr*100, "%");
      console.log("Overall APY:", (apy-1)*100, "%");

      await strategy.withdrawAllToVault({ from: governance }); // making sure can withdraw all for a next switch
    });
  });



  describe("Basic strategy functionality checks", function () {
    it("Deposit to vault", async function () {
      // deposit to vault such that we have something to work with
      await depositVault(farmer1, underlying, vault, farmerBalance);

      // check vault has at least farmerBalance (there could be some dust etc., so no exact check)
      let vaultUnderlying = new BigNumber(await vault.underlyingBalanceInVault());
      Utils.assertBNGte(vaultUnderlying, farmerBalance)
    });

    it("withdrawAllToVault()", async function () {
      let vaultUnderlying = new BigNumber(await vault.underlyingBalanceInVault());
      // doHardwork invests all underlying from the vault
      await controller.doHardWork(vault.address, { from: governance });
      let investedUnderlyingBalance = new BigNumber(await strategy.investedUnderlyingBalance());

      // strategy invested amount must be greater or equal than the initial vault underlying amount
      Utils.assertBNGte(investedUnderlyingBalance, vaultUnderlying)

      // move all invested underlying back to the vault
      await strategy.withdrawAllToVault({ from: governance });

      // strategy has no underlying left
      let investedUnderlyingBalanceNew = new BigNumber(await strategy.investedUnderlyingBalance());
      assert.equal(investedUnderlyingBalanceNew.eq(BigNumber(0)), true);

      // vault has all of the underlying from the strategy
      let vaultUnderlyingNew = new BigNumber(await vault.underlyingBalanceInVault());
      Utils.assertBNGte(vaultUnderlyingNew, investedUnderlyingBalance)
    });

    it("withdrawToVault(uint256 _amount)", async function () {
      let vaultUnderlying = new BigNumber(await vault.underlyingBalanceInVault());
      // doHardwork invests all underlying from the vault
      await controller.doHardWork(vault.address, { from: governance });
      let investedUnderlyingBalance = new BigNumber(await strategy.investedUnderlyingBalance());

      // strategy invested amount must be greater or equal than the initial vault underlying amount
      Utils.assertBNGte(investedUnderlyingBalance, vaultUnderlying)

      let amount = 1;
      // move amount of underlying to vault
      await strategy.withdrawToVault(amount, { from: governance });

      // vault has exactly amount of underlying
      let vaultUnderlyingNew = new BigNumber(await vault.underlyingBalanceInVault());
      assert.equal(new BigNumber(amount).eq(vaultUnderlyingNew), true);
    });

    it("unsalvagableTokens(address _token)", async function () {
      // underlying is unsalvageable
      let isUnderlyingUnsalvagable = await strategy.unsalvagableTokens(underlying.address);
      assert.equal(isUnderlyingUnsalvagable, true);

      // rewardToken is unsalvageable
      let isRewardTokenUnsalvagable = await strategy.unsalvagableTokens(await strategy.rewardToken());
      assert.equal(isRewardTokenUnsalvagable, true);

    });

    it("Remove all deposited LP tokens", async function () {
      // remove all deposited LP tokens
      let fTokenBalance = await vault.balanceOf(farmer1);
      await vault.withdraw(fTokenBalance, { from: farmer1 });

      //check that there is nothing left in the strategy or vault
      let strategyBalance = new BigNumber(await underlying.balanceOf(strategy.address));
      assert.equal(strategyBalance.eq(BigNumber(0)), true);

      let vaultBalance = new BigNumber(await underlying.balanceOf(vault.address));
      assert.equal(vaultBalance.eq(BigNumber(0)), true);

      let totalUnderlyingVaultAndStrategy = new BigNumber(await vault.underlyingBalanceWithInvestment());
      assert.equal(totalUnderlyingVaultAndStrategy.eq(BigNumber(0)), true);
    });
  });

});
