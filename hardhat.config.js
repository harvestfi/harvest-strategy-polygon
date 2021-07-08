require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-web3");
require('hardhat-deploy');

const secret = require('./dev-keys.json');
require("solidity-coverage");

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 137,
      accounts: {
        mnemonic: secret.mnemonic,
      },
      forking: {
        url: `https://polygon-mainnet.infura.io/v3/${secret.infuraKey}`,
      },
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ],
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 2000000
  }
};
