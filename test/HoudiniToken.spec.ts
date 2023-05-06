import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";

import { HoudiniToken, VestingContract } from "../typechain-types";
import { string } from "hardhat/internal/core/params/argumentTypes";

chai.use(chaiAsPromised);

describe("HoudiniToken", () => {
    let token: HoudiniToken;
    let vesting: VestingContract;

    let projectWallet: SignerWithAddress;
    let rewardWallet: SignerWithAddress;
    let communityAirDropWallet: SignerWithAddress;
    let marketingDevelopmentWallet: SignerWithAddress;
    let teamWallet: SignerWithAddress;
    let liquidityWallet: SignerWithAddress;

    const totalSupply = ethers.utils.parseEther("10000000");
    const rewardsSupply = ethers.utils.parseEther("4500000");
    const privateSaleSupply = ethers.utils.parseEther("1800000");
    const publicSaleSupply = ethers.utils.parseEther("1300000");
    const communityAirDropSupply = ethers.utils.parseEther("1000000");
    const marketingDevelopmentSupply = ethers.utils.parseEther("800000");
    const teamSupply = ethers.utils.parseEther("500000");
    const liquiditySupply = ethers.utils.parseEther("100000");

    let wallets: string[];

    before(async () => {
        [projectWallet, rewardWallet, communityAirDropWallet, marketingDevelopmentWallet, teamWallet, liquidityWallet] = await ethers.getSigners();
        wallets = [projectWallet.address, rewardWallet.address, communityAirDropWallet.address, marketingDevelopmentWallet.address, teamWallet.address, liquidityWallet.address];
    });

    beforeEach(async () => {
        const tokenFactory = await ethers.getContractFactory("HoudiniToken");
        token = (await tokenFactory.deploy(wallets)) as HoudiniToken;

        vesting = await ethers.getContractAt("VestingContract", await token.getVestingContract()) as VestingContract;
    });

    describe("constructor", () => {
        it("should correctly initialize the contract", async () => {
            expect(await token.totalSupply()).to.equal(totalSupply);
            expect(await token.balanceOf(projectWallet.address)).to.equal(privateSaleSupply.add(publicSaleSupply));
            expect(await token.balanceOf(liquidityWallet.address)).to.equal(liquiditySupply);

            expect(await token.balanceOf(token.address)).to.equal(totalSupply.sub(privateSaleSupply).sub(publicSaleSupply).sub(liquiditySupply));
        });
    });

    describe("initializeVesting", () => {
        it("should only be callable once", async () => {
            await token.initializeVesting();
            await expect(token.initializeVesting()).to.be.revertedWith("Initializable: contract is already initialized");
        });

        it("should correctly create vesting schedules", async () => {
            await expect(token.initializeVesting()).to.changeTokenBalance(token, vesting, totalSupply.sub(privateSaleSupply).sub(publicSaleSupply).sub(liquiditySupply));

            const vestingScheduleRewards = await vesting.vestingSchedules(rewardWallet.address, 0);
            expect(vestingScheduleRewards.amountTotal).to.equal(rewardsSupply);

            const vestingScheduleCommunityAirDrop = await vesting.vestingSchedules(communityAirDropWallet.address, 0);
            expect(vestingScheduleCommunityAirDrop.amountTotal).to.equal(communityAirDropSupply);

            const vestingScheduleMarketingDevelopment = await vesting.vestingSchedules(marketingDevelopmentWallet.address, 0);
            expect(vestingScheduleMarketingDevelopment.amountTotal).to.equal(marketingDevelopmentSupply);

            const vestingScheduleTeam = await vesting.vestingSchedules(teamWallet.address, 0);
            expect(vestingScheduleTeam.amountTotal).to.equal(teamSupply);
        });
    });
});

