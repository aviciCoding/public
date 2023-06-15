import { HardhatUserConfig } from "hardhat/config";

import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";

const config: HardhatUserConfig = {
  zksolc: {
    version: "1.3.7",
    compilerSource: "binary",
    settings: {},
  },
  networks: {
    hardhat: {
      zksync: true,
    },
    zkSyncMainnet: {
      url: "https://mainnet.era.zksync.io",
      ethNetwork: "mainnet",
      zksync: true,
      verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
    },
    zkSyncTestnet: {
      zksync: true,
      ethNetwork: "goerli",
      url: "https://zksync2-testnet.zksync.dev",
      verifyURL: "https://zksync2-testnet-explorer.zksync.dev/contract_verification",
    },
  },
  etherscan: {
    apiKey: "HPF6FGCRCX67UXMH1FTWRIYQEYTKQ5ZJY4",
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};

export default config;
