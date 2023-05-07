import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";

import { HoudiniToken, PrivateSale, VestingContract } from "../typechain-types";

chai.use(chaiAsPromised);

enum Tier {
    NULL,
    J,
    GOLD,
    PLATINUM,
    DIAMOND
}

describe("PrivateSale", () => {
    let token: HoudiniToken;
    let privateSale: PrivateSale;
    let vesting: VestingContract;

    let deployer: SignerWithAddress;

    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let dan: SignerWithAddress;
    let eve: SignerWithAddress;

    let startTime: number;
    let endTime: number;
    let aidropStartTime: number;

    const privateSaleSupply = ethers.utils.parseEther("1300000");

    const increaseTime = async (seconds: number) => {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine", []);
    }

    before(async () => {
        [deployer, alice, bob, carol, dan, eve] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const tokenFactory = await ethers.getContractFactory("HoudiniToken");
        token = (await tokenFactory.deploy([deployer.address, deployer.address, deployer.address, deployer.address, deployer.address, deployer.address])) as HoudiniToken;

        vesting = (await ethers.getContractAt("VestingContract", await token.getVestingContract())) as VestingContract;

        startTime = (await ethers.provider.getBlock("latest")).timestamp + 60;
        endTime = startTime + 86400;
        aidropStartTime = endTime + 86400;

        const privateSaleFactory = await ethers.getContractFactory("PrivateSale");
        privateSale = (await privateSaleFactory.deploy(token.address, startTime, endTime, aidropStartTime)) as PrivateSale;

        await token.transfer(privateSale.address, privateSaleSupply);
    });

    describe("constructor", () => {
        it("should correctly initialize the contract", async () => {
            expect(await privateSale.houdiniToken()).to.equal(token.address);
            expect(await privateSale.vestingContract()).to.equal(vesting.address);
            expect(await privateSale.start()).to.equal(startTime);
            expect(await privateSale.end()).to.equal(endTime);
            expect(await privateSale.owner()).to.equal(deployer.address);
        });
    });

    describe("buyTokens", () => {
        it("should revert if not started", async function () {
            await expect(privateSale.connect(alice).buy()).to.be.revertedWith("Sale has not started yet");
        });

        it("should revert if ended", async function () {
            await increaseTime(60 * 60 * 24 + 61);
            await expect(privateSale.connect(alice).buy()).to.be.revertedWith("Sale has ended");
        });

        it("should revert if amount is 0", async function () {
            await increaseTime(60);
            await expect(privateSale.connect(alice).buy({ value: 0 })).to.be.revertedWith("Amount must be greater than 0");
        });

        it("should revert if buyer has no tier", async function () {
            await increaseTime(60);
            await expect(privateSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") })).to.be.revertedWith("Not enough tokens left for this tier or no tier");
        });

        it("should revert if the per user allocation is exceeded", async function () {
            await increaseTime(60);

            // await privateSale.addTier([alice.address], Tier.J);
            // await expect(privateSale.connect(alice).buy({ value: ethers.utils.parseEther("1.0001") })).to.be.revertedWith("Allocation per user reached");

            await privateSale.addTier([bob.address], Tier.GOLD);
            await expect(privateSale.connect(bob).buy({ value: ethers.utils.parseEther("2.5001") })).to.be.revertedWith("Allocation per user reached");

            await privateSale.addTier([carol.address], Tier.PLATINUM);
            await expect(privateSale.connect(carol).buy({ value: ethers.utils.parseEther("5.0001") })).to.be.revertedWith("Allocation per user reached");
        });

        it("should rever if thier total allocation is exceeded", async function () {
            await increaseTime(60);
            await privateSale.addTier([alice.address, bob.address, carol.address], Tier.DIAMOND);

            await privateSale.connect(alice).buy({ value: ethers.utils.parseEther("40") })
            await privateSale.connect(bob).buy({ value: ethers.utils.parseEther("40") })
            await privateSale.connect(carol).buy({ value: ethers.utils.parseEther("20") })

            await expect(privateSale.connect(carol).buy({ value: ethers.utils.parseEther("20") })).to.be.revertedWith("Not enough tokens left for this tier or no tier");
        });

        it("should correctly buy tokens", async function () {
            await increaseTime(60);
            await privateSale.addTier([alice.address], Tier.DIAMOND);

            const expectedToeknsBought = ethers.utils.parseEther("0.2").mul(ethers.utils.parseEther("1")).div(await privateSale.PRICE())

            await expect(privateSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") })).to.emit(privateSale, "TokensBought").withArgs(alice.address, expectedToeknsBought)
            expect(await privateSale.totalTokensBought()).to.equal(expectedToeknsBought)
            expect(await privateSale.amountBought(alice.address)).to.equal(expectedToeknsBought);
            expect(await privateSale.tierTotalBought(Tier.DIAMOND)).to.equal(expectedToeknsBought);
        });
    });

    describe("airdrop", function () {
        this.beforeEach(async () => {
            await privateSale.addTier([alice.address, bob.address, carol.address], Tier.DIAMOND);
            await privateSale.addTier([dan.address, eve.address], Tier.PLATINUM);
        });

        it("should revert if the sale has not ended", async function () {
            await increaseTime(60);
            await privateSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") });

            await expect(privateSale.connect(alice).airdrop([])).to.be.revertedWith("Sale has not ended yet");
        });

        it("should correctly claim ETH", async function () {
            await increaseTime(60);
            await privateSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") });
            await increaseTime(60 * 60 * 24 + 1);

            await privateSale.endSale();

            await expect(privateSale.connect(alice).airdrop([alice.address])).to.changeEtherBalance(alice, ethers.utils.parseEther("0.2").sub(1));
        });

        it("should revert if the airdrop start time has not been reached", async function () {
            await increaseTime(60);
            await privateSale.connect(alice).buy({ value: ethers.utils.parseEther("40") });
            await privateSale.connect(bob).buy({ value: ethers.utils.parseEther("40") });
            await privateSale.connect(carol).buy({ value: ethers.utils.parseEther("39") });
            await privateSale.connect(dan).buy({ value: ethers.utils.parseEther("5") });
            await privateSale.connect(eve).buy({ value: ethers.utils.parseEther("5") });
            await increaseTime(60 * 60 * 24 + 1);

            await privateSale.endSale();

            await expect(privateSale.connect(alice).airdrop([alice.address])).to.be.revertedWith("Airdrop has not started yet");
        });

        it("should correctly claim tokens", async function () {
            await increaseTime(60);
            await privateSale.connect(alice).buy({ value: ethers.utils.parseEther("40") });
            await privateSale.connect(bob).buy({ value: ethers.utils.parseEther("40") });
            await privateSale.connect(carol).buy({ value: ethers.utils.parseEther("39") });
            await privateSale.connect(dan).buy({ value: ethers.utils.parseEther("5") });
            await privateSale.connect(eve).buy({ value: ethers.utils.parseEther("5") });
            await increaseTime(60 * 60 * 24 + 1);

            await privateSale.endSale();

            await increaseTime(60 * 60 * 24 + 1);

            await privateSale.connect(alice).airdrop([alice.address]);

            const totalTokensBoughtAlice = ethers.utils.parseEther("40").mul(ethers.utils.parseEther("1")).div(await privateSale.PRICE());
            const tokensToBeSentAlice = totalTokensBoughtAlice.mul(1500).div(10000);
            const tokensToBeVestedAlice = totalTokensBoughtAlice.sub(tokensToBeSentAlice);

            expect(await token.balanceOf(alice.address)).to.equal(tokensToBeSentAlice);

            const aliceVentingSchedule = await vesting.vestingSchedules(alice.address, 0);
            expect(aliceVentingSchedule.amountTotal).to.equal(tokensToBeVestedAlice);
        });
    });

    describe("endSale", function () {
        this.beforeEach(async () => {
            await privateSale.addTier([alice.address, bob.address, carol.address], Tier.DIAMOND);
            await privateSale.addTier([dan.address, eve.address], Tier.PLATINUM);
        });

        it("should revert if the sale has not ended", async function () {
            await expect(privateSale.endSale()).to.be.revertedWith("Sale has not ended yet");
        });

        it("should revert if the sale has already ended", async function () {
            await increaseTime(60);
            await privateSale.connect(alice).buy({ value: ethers.utils.parseEther("0.2") });
            await increaseTime(60 * 60 * 24 + 1);

            await privateSale.endSale();

            await expect(privateSale.endSale()).to.be.revertedWith("Sale has already ended");
        });

        it("should correctly end the sale if softcap is not reached", async function () {
            await increaseTime(60);
            await privateSale.connect(alice).buy({ value: ethers.utils.parseEther("2") });
            await increaseTime(60 * 60 * 24 + 1);

            await expect(privateSale.endSale()).to.emit(privateSale, "SaleEnded").to.changeTokenBalance(token, deployer, privateSaleSupply);
            expect(await privateSale.saleEnded()).to.be.true;

            expect(await privateSale.softCapReached()).to.be.false;

        });

        it("should correctly send ETH and Token to the team wallet", async function () {
            await increaseTime(60);
            await privateSale.connect(alice).buy({ value: ethers.utils.parseEther("40") });
            await privateSale.connect(bob).buy({ value: ethers.utils.parseEther("40") });
            await privateSale.connect(carol).buy({ value: ethers.utils.parseEther("35") });
            await privateSale.connect(dan).buy({ value: ethers.utils.parseEther("5") });
            await privateSale.connect(eve).buy({ value: ethers.utils.parseEther("5") });
            await increaseTime(60 * 60 * 24 + 1);

            await expect(privateSale.endSale()).to.emit(privateSale, "SaleEnded").to.changeTokenBalance(token, deployer, privateSaleSupply.sub(await privateSale.totalTokensBought())).to.changeEtherBalance(deployer.address, ethers.utils.parseEther("125"));
            expect(await privateSale.saleEnded()).to.be.true;
        });
    });

    describe("addTier", function () {
        it("revert if caller in not the owner", async function () {
            await expect(privateSale.connect(alice).addTier([alice.address], Tier.DIAMOND)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should correctly add a tier", async function () {
            await privateSale.addTier([alice.address], Tier.DIAMOND);

            expect(await privateSale.tier(alice.address)).to.equal(Tier.DIAMOND);
        });
    });
});