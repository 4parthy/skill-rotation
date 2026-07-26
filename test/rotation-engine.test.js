'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const RotationEngine = require('../lib/rotation-engine');

function createEngine() {
    const readiness = new Map();
    const logs = [];
    const mod = {
        hook() {},
        log(message) {
            logs.push(message);
        }
    };
    const stateTracker = {
        isSkillReady(skill) {
            const group = Math.floor(skill.id / 10000);
            return readiness.get(group) !== false;
        }
    };
    return {
        engine: new RotationEngine(mod, stateTracker, new EventEmitter()),
        readiness,
        logs
    };
}

function skill(name, group) {
    return {
        name,
        id: group * 10000
    };
}

function names(rotation) {
    return rotation.map(s => s.name);
}

const config = [
    skill('1', 1),
    skill('2', 2),
    skill('3', 3),
    skill('4', 4)
];

const { engine, readiness, logs } = createEngine();

engine.update(config);
assert.deepStrictEqual(names(engine.currentRotation), ['1', '2', '3', '4']);

assert.strictEqual(engine.skillUsed(1, config), true);
readiness.set(1, false);
engine.update(config);
assert.deepStrictEqual(names(engine.currentRotation), ['2', '3', '4', '1']);

assert.strictEqual(engine.skillUsed(2, config), true);
readiness.set(2, false);
engine.update(config);
assert.deepStrictEqual(names(engine.currentRotation), ['3', '4', '1', '2']);

assert.strictEqual(engine.skillUsed(99, config), false);
assert(logs.some(message => message.includes('Used skill group 99 is not tracked by the active rotation config.')));

console.log('rotation-engine tests passed');