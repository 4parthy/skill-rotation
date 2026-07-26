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
        hook(name, version, callback) {
            hooks.set(name, callback);
        },
        log(message) {
            logs.push(message);
        }
    };

    events.on('skill-used', (group, skill, source) => skillUses.push({ group, skill, source }));
    events.on('state-changed', () => stateChanges.push(true));

    new StateTracker(mod, events);

    return { hooks, logs, skillUses, stateChanges };
}

const { hooks, logs, skillUses, stateChanges } = createTracker();

hooks.get('S_START_COOLTIME_SKILL')({
    skill: { id: 30100 },
    cooldown: 2285
});

assert.strictEqual(skillUses.length, 1);
assert.strictEqual(skillUses[0].group, 3);
assert.strictEqual(skillUses[0].source, 'cooldown-start');
assert.strictEqual(stateChanges.length, 1);
assert(logs.some(message => message.includes('Cooldown started: id=30100, group=3 for 2285ms')));

hooks.get('S_START_COOLTIME_SKILL')({
    skill: { id: 40100 },
    cooldown: 0
});

assert.strictEqual(skillUses.length, 1);
assert.strictEqual(stateChanges.length, 2);

hooks.get('S_ACTION_STAGE')({
    gameId: 123n,
    skill: { id: 20100 },
    stage: 0n
});

assert.strictEqual(skillUses.length, 2);
assert.strictEqual(skillUses[1].group, 2);
assert.strictEqual(skillUses[1].source, 'action-stage');
assert(logs.some(message => message.includes('Player action stage: id=20100, group=2')));

hooks.get('S_ACTION_STAGE')({
    gameId: 999n,
    skill: { id: 100100 },
    stage: 0
});

assert.strictEqual(skillUses.length, 2);

console.log('state-tracker tests passed');