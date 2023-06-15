# Houdini Finance Token, Private sale, Public sale and Vesting Smart Contracts.

## HoudiniToken.sol

The token contract should be deployed first with the array of addresses of the wallets/multisigs for each allocation passed as param for the constructor.

The token contract will mint the total supply(the Vesting Contract will be deployed by this contract's constructor). It will also send the tokens for the private sale and public sale to the deployer so that they can be distributed later to the Public and Private sale contracts.

To start the vesting schedules, call the `initializeVesting()`.

## HoudiniPrivateSale.sol

The private sale contract should be deployed after the token contract. The token contract should be passed as param for the constructor, along with the start and end date for the sale and the airdrop start time (all in unix timestamp).

The deployer shoudl also send the tokens for the private sale to this contract.

To assign tiers to addresses, the owner can call the `setTier(address[] _addresses, Tier _tier)` function. All addresses will have the tier `NULL` by default, which counts as no tier(no allocation and thus can't buy tokens).

After the sale is over, anyone can call the `endSale()` function to process the result of the sale.

To claim or aidrop tokens or refund the ETH, anyone can call the `aridrop(address[])` function, which will do one or the other depending on the result of the sale. If the sale was successful, the airdrop function will only work after the airdrop start time has been reached.

## HoudiniPublicSale.sol

The public sale contract should be deployed after the token contract. The token contract should be passed as param for the constructor, along with the start and end date for the sale and the airdrop start time (all in unix timestamp).

The deployer shoudl also send the tokens for the public sale to this contract.

After the sale is over, anyone can call the `endSale()` function to process the result of the sale.

To claim or aidrop tokens or refund the ETH, anyone can call the `aridrop(address[])` function, which will do one or the other depending on the result of the sale. If the sale was successful, the airdrop function will only work after the airdrop start time has been reached.
# public
