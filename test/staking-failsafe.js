const StakingRewards = artifacts.require('StakingRewards');
const SkillToken = artifacts.require('SkillToken');

contract('StakingRewards', accounts => {
  describe('failsafe mode', () => {
    let sr;
    beforeEach(async () => {
      const skill = await SkillToken.deployed();

      sr = await StakingRewards.new(accounts[0], accounts[0], skill.address, skill.address, 0);
    });

    it('should allow stakers to recover their stake, and owner to recover staking tokens that were not staked', async () => {
      const skill = await SkillToken.deployed();

      assert.isFalse(await sr.failsafeModeActive(), 'Failsafe Mode should be disabled');

      // stake 200
      await skill.increaseAllowance(sr.address, 200, { from: accounts[0] });
      await sr.stake(200, { from: accounts[0] });

      // transfer extra 300 skill that wasn't actually staked
      await skill.transfer(sr.address, 300, { from: accounts[0] });

      assert.strictEqual((await sr.balanceOf(accounts[0])).toNumber(), 200);
      assert.strictEqual((await skill.balanceOf(sr.address)).toNumber(), 500);

      await sr.enableFailsafeMode({ from: accounts[0] });

      const account0SkillBalanceBefore = (await skill.balanceOf(accounts[0])).toNumber();

      await sr.recoverOwnStake({ from: accounts[0] });
      assert.strictEqual((await sr.balanceOf(accounts[0])).toNumber(), 0);
      assert.strictEqual((await sr.totalSupply()).toNumber(), 0);
      assert.strictEqual((await skill.balanceOf(sr.address)).toNumber(), 300);
      assert.strictEqual((await skill.balanceOf(accounts[0])).toNumber(), account0SkillBalanceBefore + 200);

      await sr.recoverExtraStakingTokensToOwner({ from: accounts[0] });
      assert.strictEqual((await sr.balanceOf(accounts[0])).toNumber(), 0);
      assert.strictEqual((await sr.totalSupply()).toNumber(), 0);
      assert.strictEqual((await skill.balanceOf(sr.address)).toNumber(), 0);
      assert.strictEqual((await skill.balanceOf(accounts[0])).toNumber(), account0SkillBalanceBefore + 500);
    });

    it('should prevent any normal functionality when in failsafe mode', async () => {
      assert.isFalse(await sr.failsafeModeActive(), 'Failsafe Mode should be disabled');

      await sr.enableFailsafeMode({ from: accounts[0] });

      try {
        await sr.setMinimumStakeTime(100, { from: accounts[0] });
        assert.fail('Expected to throw an error');
      }
      catch (e) {
        assert.match(e.message, /Reason given: This action cannot be performed while the contract is in Failsafe Mode/ig);
      }
    });
  });
});

