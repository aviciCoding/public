import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";

import { HoudiniToken, PublicSale, VestingContract } from "../typechain-types";

chai.use(chaiAsPromised);

describe("PublicSale", () => {
    let token: HoudiniToken;
    let publicSale: PublicSale;
    let vesting: VestingContract;

    let deployer: SignerWithAddress;

    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;

    let startTime: number;
    let endTime: number;
    let aidropStartTime: number;

    const publicSaleSupply = ethers.utils.parseEther("1300000");

    const increaseTime = async (seconds: number) => {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine", []);
    }

    before(async () => {
        [deployer, alice, bob, carol] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const tokenFactory = await ethers.getContractFactory("HoudiniToken");
        token = (await tokenFactory.deploy([deployer.address, deployer.address, deployer.address, deployer.address, deployer.address, deployer.address])) as HoudiniToken;

        vesting = (await ethers.getContractAt("VestingContract", await token.getVestingContract())) as VestingContract;

        startTime = (await ethers.provider.getBlock("latest")).timestamp + 60;
        endTime = startTime + 86400;
        aidropStartTime = endTime + 86400;

        const publicSaleFactory = await ethers.getContractFactory("PublicSale");
        publicSale = (await publicSaleFactory.deploy(token.address, startTime, endTime, aidropStartTime)) as PublicSale;

        await token.transfer(publicSale.address, publicSaleSupply);
    });

    describe("constructor", () => {
        it("should correctly initialize the contract", async () => {
            expect(await publicSale.houdiniToken()).to.equal(token.address);
            expect(await publicSale.vestingContract()).to.equal(vesting.address);
            expect(await publicSale.start()).to.equal(startTime);
            expect(await publicSale.end()).to.equal(endTime);
            expect(await publicSale.owner()).to.equal(deployer.address);
        });
    });

    describe("buyTokens", () => {
        it("should revert if not started", async function () {
            await expect(publicSale.connect(alice).buy()).to.be.revertedWith("Sale has not started yet");
        });

        it("should revert if ended", async function () {
            await increaseTime(60 * 60 * 24 + 61);
            await expect(publicSale.connect(alice).buy()).to.be.revertedWith("Sale has ended");
        });

        it("should revert if amount is 0", async function () {
            await increaseTime(60);
            await expect(publicSale.connect(alice).buy({ value: 0 })).to.be.revertedWith("Amount must be greater than 0");
        });

        it("should revert if total sale amount is exceeded", async function () {
            await increaseTime(60);
            await expect(publicSale.connect(alice).buy({ value: ethers.utils.parseEther("345.1") })).to.be.revertedWith("Hard cap reached");
        });

        it("should correctly buy tokens", async function () {
            await increaseTime(60);
            const expectedToeknsBought = ethers.utils.parseEther("0.2").mul(ethers.utils.parseEther("1")).div(await publicSale.PRICE())

            await expect(publicSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") })).to.emit(publicSale, "TokensBought").withArgs(alice.address, expectedToeknsBought)
            expect(await publicSale.totalTokensBought()).to.equal(expectedToeknsBought)
            expect(await publicSale.amountBought(alice.address)).to.equal(expectedToeknsBought);
        });
    });

    describe("airdrop", function () {
        it("should revert if the sale has not ended", async function () {
            await increaseTime(60);
            await publicSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") });

            await expect(publicSale.connect(alice).airdrop([])).to.be.revertedWith("Sale has not ended yet");
        });

        it("should correctly claim ETH", async function () {
            await increaseTime(60);
            await publicSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") });
            await increaseTime(60 * 60 * 24 + 1);

            await publicSale.endSale();

            await expect(publicSale.connect(alice).airdrop([alice.address])).to.changeEtherBalance(alice, ethers.utils.parseEther("0.2").sub(1));
        });

        it("should revert if the airdrop start time has not been reached", async function () {
            await increaseTime(60);
            await publicSale.connect(alice).buy({ value: ethers.utils.parseEther("60") });
            await publicSale.connect(bob).buy({ value: ethers.utils.parseEther("60") });
            await publicSale.connect(carol).buy({ value: ethers.utils.parseEther("60") });
            await increaseTime(60 * 60 * 24 + 1);

            await publicSale.endSale();

            await expect(publicSale.connect(alice).airdrop([alice.address])).to.be.revertedWith("Airdrop has not started yet");
        });

        it("should correctly claim tokens", async function () {
            await increaseTime(60);
            await publicSale.connect(alice).buy({ value: ethers.utils.parseEther("60") });
            await publicSale.connect(bob).buy({ value: ethers.utils.parseEther("60") });
            await publicSale.connect(carol).buy({ value: ethers.utils.parseEther("60") });
            await increaseTime(60 * 60 * 24 + 1);

            await publicSale.endSale();

            await increaseTime(60 * 60 * 24 + 1);

            await publicSale.connect(alice).airdrop([alice.address]);

            const totalTokensBoughtAlice = ethers.utils.parseEther("60").mul(ethers.utils.parseEther("1")).div(await publicSale.PRICE());
            const tokensToBeSentAlice = totalTokensBoughtAlice.mul(2500).div(10000);
            const tokensToBeVestedAlice = totalTokensBoughtAlice.sub(tokensToBeSentAlice);

            expect(await token.balanceOf(alice.address)).to.equal(tokensToBeSentAlice);

            const aliceVentingSchedule = await vesting.vestingSchedules(alice.address, 0);
            expect(aliceVentingSchedule.amountTotal).to.equal(tokensToBeVestedAlice);
        });
    });

    describe("endSale", function () {
        it("should revert if the sale has not ended", async function () {
            await expect(publicSale.endSale()).to.be.revertedWith("Sale has not ended yet");
        });

        it("should revert if the sale has already ended", async function () {
            await increaseTime(60);
            await publicSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") });
            await increaseTime(60 * 60 * 24 + 1);

            await publicSale.endSale();

            await expect(publicSale.endSale()).to.be.revertedWith("Sale has already ended");
        });

        it("should correctly end the sale if softcap is not reached", async function () {
            await increaseTime(60);
            await publicSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") });
            await increaseTime(60 * 60 * 24 + 1);

            await expect(publicSale.endSale()).to.emit(publicSale, "SaleEnded").to.changeTokenBalance(token, deployer, publicSaleSupply);
            expect(await publicSale.saleEnded()).to.be.true;

            expect(await publicSale.softCapReached()).to.be.false;

        });

        it("should correctly send ETH and Token to the team wallet", async function () {
            await increaseTime(60);
            await publicSale.connect(alice).buy({ value: ethers.utils.parseEther("60") });
            await publicSale.connect(bob).buy({ value: ethers.utils.parseEther("60") });
            await publicSale.connect(carol).buy({ value: ethers.utils.parseEther("60") });
            await increaseTime(60 * 60 * 24 + 1);

            await expect(publicSale.endSale()).to.emit(publicSale, "SaleEnded").to.changeTokenBalance(token, deployer, publicSaleSupply.sub(await publicSale.totalTokensBought())).to.changeEtherBalance(deployer.address, ethers.utils.parseEther("180"));
            expect(await publicSale.saleEnded()).to.be.true;
        });
    });
});