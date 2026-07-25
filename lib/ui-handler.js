'use strict';

module.exports = function UIHandler(mod) {
    this.display = (rotation, history, inCombat) => {
        if (!inCombat || !rotation || rotation.length === 0) {
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
        
        mod.send('S_DUNGEON_EVENT_MESSAGE', '*', {
            type: 33,
            chat: false,
            channel: 0,
            message: msg
        });
    };

    this.clear = () => {
        mod.send('S_DUNGEON_EVENT_MESSAGE', '*', {
            type: 33,
            chat: false,
            channel: 0,
            message: ''
        });
    };
};
