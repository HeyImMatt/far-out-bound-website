import { createPlayerController } from '../js/player-controller.mjs';

const assert = {
    equal(actual, expected) {
        if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
    },
    deepEqual(actual, expected) {
        const received = JSON.stringify(actual);
        const wanted = JSON.stringify(expected);
        if (received !== wanted) throw new Error(`Expected ${wanted}, received ${received}`);
    },
    throws(run, pattern) {
        try {
            run();
        } catch (error) {
            if (pattern.test(error.message)) return;
            throw new Error(`Expected error matching ${pattern}, received ${error.message}`);
        }
        throw new Error(`Expected error matching ${pattern}, but nothing was thrown`);
    },
};

const tests = [];
function test(name, run) {
    tests.push({ name, run });
}

function makeWidget() {
    return {
        duration: 200000,
        playCalls: 0,
        pauseCalls: 0,
        seekCalls: [],
        play() { this.playCalls += 1; },
        pause() { this.pauseCalls += 1; },
        getDuration(callback) { callback(this.duration); },
        seekTo(milliseconds) { this.seekCalls.push(milliseconds); },
    };
}

test('registering an available track reports that it is ready', () => {
    const readyTracks = [];
    const controller = createPlayerController(['launch'], {
        onReady: id => readyTracks.push(id),
    });

    controller.register('launch', makeWidget());

    assert.deepEqual(readyTracks, ['launch']);
});

test('selecting another track pauses the current track before playing the new one', () => {
    const changes = [];
    const controller = createPlayerController(['days', 'launch'], {
        onStateChange: state => changes.push(state),
    });
    const days = makeWidget();
    const launch = makeWidget();
    controller.register('days', days);
    controller.register('launch', launch);

    controller.toggle('days');
    controller.handlePlay('days');
    controller.toggle('launch');

    assert.equal(days.pauseCalls, 1);
    assert.equal(launch.playCalls, 1);
    assert.deepEqual(controller.getState(), { activeId: 'launch', playing: true });
    assert.deepEqual(changes[changes.length - 1], { activeId: 'launch', playing: true });
});

test('a stale play event cannot override a newer track selection', () => {
    const controller = createPlayerController(['days', 'launch']);
    const days = makeWidget();
    const launch = makeWidget();
    controller.register('days', days);
    controller.register('launch', launch);

    controller.toggle('days');
    controller.toggle('launch');
    controller.handlePlay('days');

    assert.deepEqual(controller.getState(), { activeId: 'launch', playing: true });
    assert.equal(days.pauseCalls, 2);
    assert.equal(launch.pauseCalls, 0);
});

test('toggling the active playing track pauses it', () => {
    const controller = createPlayerController(['days']);
    const days = makeWidget();
    controller.register('days', days);
    controller.toggle('days');
    controller.handlePlay('days');

    controller.toggle('days');

    assert.equal(days.pauseCalls, 1);
});

test('the record control starts the default track when nothing is playing', () => {
    const controller = createPlayerController(['launch', 'days']);
    const launch = makeWidget();
    controller.register('launch', launch);
    controller.register('days', makeWidget());

    controller.toggleCurrentOr('launch');

    assert.equal(launch.playCalls, 1);
    assert.deepEqual(controller.getState(), { activeId: 'launch', playing: true });
});

test('the record control pauses whichever track is currently playing', () => {
    const controller = createPlayerController(['launch', 'days']);
    const launch = makeWidget();
    const days = makeWidget();
    controller.register('launch', launch);
    controller.register('days', days);
    controller.toggle('days');
    controller.handlePlay('days');

    controller.toggleCurrentOr('launch');

    assert.equal(days.pauseCalls, 1);
    assert.equal(launch.playCalls, 0);
    assert.deepEqual(controller.getState(), { activeId: 'days', playing: false });
});

test('the record control resumes the last selected track after pausing', () => {
    const controller = createPlayerController(['launch', 'days']);
    const launch = makeWidget();
    const days = makeWidget();
    controller.register('launch', launch);
    controller.register('days', days);
    controller.toggle('days');
    controller.handlePlay('days');
    controller.toggleCurrentOr('launch');

    controller.toggleCurrentOr('launch');

    assert.equal(days.playCalls, 2);
    assert.equal(launch.playCalls, 0);
    assert.deepEqual(controller.getState(), { activeId: 'days', playing: true });
});

test('progress updates are clamped and ignored for inactive tracks', () => {
    const updates = [];
    const controller = createPlayerController(['days', 'launch'], {
        onProgress: (id, ratio) => updates.push([id, ratio]),
    });
    controller.register('days', makeWidget());
    controller.register('launch', makeWidget());
    controller.toggle('days');
    controller.handlePlay('days');

    controller.handleProgress('launch', 0.4);
    controller.handleProgress('days', 1.4);
    controller.handleProgress('days', -0.2);

    assert.deepEqual(updates, [['days', 1], ['days', 0]]);
});

test('seeking converts a clamped timeline ratio into track milliseconds', () => {
    const updates = [];
    const controller = createPlayerController(['days'], {
        onProgress: (id, ratio) => updates.push([id, ratio]),
    });
    const days = makeWidget();
    controller.register('days', days);

    controller.seek('days', 0.25);
    controller.seek('days', 1.4);

    assert.deepEqual(days.seekCalls, [50000, 200000]);
    assert.deepEqual(updates, [['days', 0.25], ['days', 1]]);
});

test('an active track error stops the playing state and exposes the failed track', () => {
    const errors = [];
    const controller = createPlayerController(['days'], {
        onError: id => errors.push(id),
    });
    controller.register('days', makeWidget());
    controller.toggle('days');
    controller.handlePlay('days');

    controller.handleError('days');

    assert.deepEqual(controller.getState(), { activeId: 'days', playing: false });
    assert.deepEqual(errors, ['days']);
});

test('unknown tracks are rejected instead of mutating playback state', () => {
    const controller = createPlayerController(['days']);

    assert.throws(() => controller.toggle('missing'), /Unknown track/);
    assert.deepEqual(controller.getState(), { activeId: null, playing: false });
});

let failures = 0;
for (const { name, run } of tests) {
    try {
        run();
        console.log(`ok - ${name}`);
    } catch (error) {
        failures += 1;
        console.error(`not ok - ${name}`);
        console.error(error);
    }
}

if (failures > 0) process.exitCode = 1;
