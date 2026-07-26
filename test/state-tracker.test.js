'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const StateTracker = require('../lib/state-tracker');

function createTracker() {
    const hooks = new Map();
    const logs = [];
    const events = new EventEmitter();
    const skillUses = [];
    const stateChanges = [];
    const mod = {
        require: {
            'tera-game-state': {
                me: {
                    gameId: 123n
                }
            }
        },
        game: {
            on() {}
        },
        hook(name, version, options, callback) {
            if (typeof options === 'function') {
                callback = options;
                options = undefined;
            }
            hooks.set(name, { version, options, callback });
        },
        log(message) {
            logs.push(message);
        }
    };

    events.on('skill-used', (group, skill, source) => skillUses.push({ group, skill, source }));
    events.on('state-changed', () => stateChanges.push(true));

    const tracker = new StateTracker(mod, events);

    return { tracker, hooks, logs, skillUses, stateChanges };
}

const { tracker, hooks, logs, skillUses, stateChanges } = createTracker();

// Cooldown packets and the simulated client cooldown are intentionally not tracked.
assert.strictEqual(hooks.has('S_START_COOLTIME_SKILL'), false);
assert.strictEqual(hooks.has('S_DECREASE_COOLTIME_SKILL'), false);
assert.strictEqual(hooks.has('S_CREST_MESSAGE'), false);
assert.strictEqual(hooks.has('C_START_SKILL'), false);

const actionStageHook = hooks.get('S_ACTION_STAGE');
assert(actionStageHook);
assert.strictEqual(actionStageHook.options.order, -10000);
assert.deepStrictEqual(actionStageHook.options.filter, { fake: null, modified: null, silenced: null });

actionStageHook.callback({
    gameId: 123n,
    skill: { id: 20100 },
    stage: 0n
});

assert.strictEqual(skillUses.length, 1);
assert.strictEqual(skillUses[0].group, 2);
assert.strictEqual(skillUses[0].source, 'action-stage');
assert(logs.some(message => message.includes('Player action stage: id=20100, group=2')));

actionStageHook.callback({
    gameId: 123n,
    skill: { id: 30100 },
    stage: 1
});

actionStageHook.callback({
    gameId: 999n,
    skill: { id: 100100 },
    stage: 0
});

assert.strictEqual(skillUses.length, 1);

assert.strictEqual(tracker.isSkillReady({ id: 40100 }), true);
assert.strictEqual(tracker.isSkillReady({
    id: 40100,
    buffs: { Self: { missing: [777] } }
}), true);

hooks.get('S_ABNORMALITY_BEGIN').callback({
    target: 123n,
    id: 777,
    duration: 10000,
    stacks: 1
});

assert.strictEqual(stateChanges.length, 1);
assert.strictEqual(tracker.isSkillReady({
    id: 40100,
    buffs: { Self: { missing: [777] } }
}), false);
assert.strictEqual(tracker.isSkillReady({
    id: 40100,
    buffs: { Self: { active: [777] } }
}), true);

hooks.get('S_ABNORMALITY_END').callback({
    target: 123n,
    id: 777
});

assert.strictEqual(tracker.isSkillReady({
    id: 40100,
    buffs: { Self: { active: [777] } }
}), false);

console.log('state-tracker tests passed');
