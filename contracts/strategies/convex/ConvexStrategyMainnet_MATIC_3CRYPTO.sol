//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/ConvexStrategy.sol";

contract ConvexStrategyMainnet_MATIC_3CRYPTO is ConvexStrategy {

  constructor() public {}

  function initializeStrategy(
    address _storage,
    address _vault
  ) public initializer {
    address underlying = address(0xb0658482b405496C4EE9453cD0a463b134aEf9d0); // Info -> LP Token address
    address rewardPool = address(0x835cA119fA28515B1F184A5Ce5Ccda2B5b0d9F6D); // Info -> Rewards contract address
    address crv = address(0x172370d5Cd63279eFa6d502DAB29171933a610AF);
    address cvx = address(0x4257EA7637c355F81616050CbB6a9b709fd72683);
    address curveDeposit = address(0x3d8EADb739D1Ef95dd53D718e4810721837c69c1);
    ConvexStrategy.initializeBaseStrategy(
      _storage,
      underlying,
      _vault,
      rewardPool, // rewardPool
      9,  // Pool id: Info -> Rewards contract address -> read -> pid
      weth, // depositToken
      5, //depositArrayPosition. Find deposit transaction -> input params
      curveDeposit, // deposit contract: usually underlying. Find deposit transaction -> interacted contract
      6, //nTokens -> total number of deposit tokens
      true, //metaPool -> if LP token address == pool address (at curve)
      false //factoryPool
    );
    rewardTokens = [crv, cvx];
    reward2WETH[crv] = [crv, weth];
    reward2WETH[cvx] = [cvx, weth];
  }
}