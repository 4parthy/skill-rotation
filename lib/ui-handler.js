'use strict';

module.exports = function UIHandler(mod) {
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
        
        mod.log(`Displaying rotation (Combat=${inCombat}): Next=${nextSkill.name}`);

        // Try to display always for testing, or only in combat if intended
        // But for debugging, let's remove the !inCombat return at the top
        
        mod.send('S_DUNGEON_EVENT_MESSAGE', '*', {
            type: 33,
            chat: false,
            channel: 0,
            message: msg
        });

        // Fallback or additional notification to chat for debugging
        mod.command.message(`Rotation: ${nextSkill.name}`);
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
