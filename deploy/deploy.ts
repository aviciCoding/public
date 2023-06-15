
import { Wallet, utils } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script for the tester contract`);

  // Initialize the wallet.
  const wallet = new Wallet('f29a83a6260322707c1853c9c362f1d8a35c230ee57c5bd67dba333fe709e28e');

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);
  
  // Load the  artifact.
//   const TokenArtifact = await deployer.loadArtifact("HoudiniToken");
  const PublicArtifact = await deployer.loadArtifact("PublicSale");
  
  // Estimate contract deployment fee for the  contract.
 
  // Deploy  contract with the address of the  contract as a constructor argument.
  // const PrivateContract = await deployer.deploy(SnrkPrivateArtifact, []);
//   const Token= await deployer.deploy(TokenArtifact, [["0xce2f109D1a6b9b06A1781657d8ba0912a3ABE014","0x38520a7207953Ea69c0a0376665eB2e97E79B18B","0x059A5a1b8C8721648bdf8c195F4b7b1788C6E1A5","0xc3FE76C90e2D4c723fEff7b6F4d65D322234423a","0xd34CBA03Eab3c175db2B71eB3Cf17a730d3cbA86","0xe7F313cC5f70850B2ff9B0820E92FA66f8E11027"]]);
const PublicContract= await deployer.deploy(PublicArtifact, ["0xa0778bFeF8971bfC268e934ebba3aad345c54E2E",1686688319,1686896601,1686896601]);

  // Show the  contract info.
//   const TokenAddress = Token.address;
//   console.log(`${Token.contractName} was deployed to ${TokenAddress}`);
console.log(`${PublicContract.contractName} was deployed to ${PublicContract.address}`);
  // console.log(`${PrivateContract} was deployed to ${PrivateContract.address}`);
}


