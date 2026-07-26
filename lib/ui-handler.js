'use strict';

module.exports = function UIHandler(mod) {
    this.lastMsg = '';
    this.lastTime = 0;
    this.minInterval = 2000; // 2 seconds between updates

    this.display = (rotation, history, inCombat) => {
        if (!rotation || rotation.length === 0) {
            this.clear();
            return;
        }

        const nextSkill = rotation[0];
        let msg = `<font color="#00FF00" size="24">Next: ${nextSkill.name}</font>`;
        
        if (rotation.length > 1) {
            msg += `<br/><font color="#FFFFFF" size="18">Future: ${rotation.slice(1).map(s => s.name).join(' > ')}</font>`;
        }
        
        if (history.length > 0) {
            msg += `<br/><font color="#888888" size="14">Prev: ${history.map(s => s.name).join(' < ')}</font>`;
        }

        const now = Date.now();
        if (msg === this.lastMsg && now - this.lastTime < this.minInterval) {
            return;
        }

        this.lastMsg = msg;
        this.lastTime = now;
        
        mod.log(`Displaying rotation (Combat=${inCombat}): Next=${nextSkill.name}`);

        mod.send('S_DUNGEON_EVENT_MESSAGE', '*', {
            type: 33,
            chat: false,
            channel: 0,
            message: msg
        });

        // Removed mod.command.message for less spam
    };

    this.clear = () => {
        if (this.lastMsg === '') return;
        this.lastMsg = '';
        mod.send('S_DUNGEON_EVENT_MESSAGE', '*', {
            type: 33,
            chat: false,
            channel: 0,
            message: ''
        });
    };
};
