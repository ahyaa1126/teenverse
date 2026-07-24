const { roleLevel } = require("./roles");

function canModerate(staffRole, targetRole) {
    return roleLevel[staffRole] > roleLevel[targetRole];
}

function hasPermission(role, action) {

    const permissions = {

        "Owner": [
            "ban",
            "kick",
            "mute",
            "unmute",
            "promote",
            "demote",
            "announcement",
            "logs",
            "delete"
        ],

        "Co-Owner": [
            "ban",
            "kick",
            "mute",
            "unmute",
            "announcement",
            "logs",
            "delete",
            "promote",
            "demote"
        ],

        "Super Admin": [
            "ban",
            "kick",
            "mute",
            "unmute",
            "announcement",
            "delete"
        ],

        "Admin": [
            "ban",
            "kick",
            "mute",
            "unmute",
            "delete"
        ],

        "Moderator": [
            "kick",
            "mute",
            "unmute",
            "delete"
        ],

        "Super VIP": [],

        "VIP": [],

        "User": []
    };

    return permissions[role]?.includes(action);
}

module.exports = {
    canModerate,
    hasPermission
};