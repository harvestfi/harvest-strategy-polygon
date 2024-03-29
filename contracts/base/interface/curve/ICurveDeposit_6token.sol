//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface ICurveDeposit_6token {
  function get_virtual_price() external view returns (uint);
  function add_liquidity(
    uint256[6] calldata amounts,
    uint256 min_mint_amount
  ) external;
  function remove_liquidity_imbalance(
    uint256[6] calldata amounts,
    uint256 max_burn_amount
  ) external;
  function remove_liquidity(
    uint256 _amount,
    uint256[6] calldata amounts
  ) external;
  function exchange(
    int128 from, int128 to, uint256 _from_amount, uint256 _min_to_amount
  ) external;
  function calc_token_amount(
    uint256[6] calldata amounts,
    bool deposit
  ) external view returns(uint);
}