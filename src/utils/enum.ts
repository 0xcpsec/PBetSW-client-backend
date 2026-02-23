// LSports enums removed - project now uses Stra188 only

export enum FixtureStatus {
    NOTSTARTEDYET               = 1,
    PROGRESS                    = 2,
    FINISHED                    = 3,
    CANCELED                    = 4,
    POSTPONED                   = 5,
    INTERRUPTED                 = 6,
    ABANDONED                   = 7,
    COVERAGELOST                = 8,
    ABOUTTOSTART                = 9
}

export enum MessageType {
    FIXTURE                     = 1,
    LIVESCORE                   = 2,
    MARKET                      = 3,
    KEEPALIVE                   = 31,
    HEARTBEAT                   = 32,
    SETTLEMENTS                 = 35,
    SNAPSHOT                    = 36,
}

export enum BetSettlement {
    Canceled            = -1,
    Loser               = 1,
    Winner              = 2,
    Refund              = 3,
    HalfLost            = 4,
    HalfWon             = 5
}

export enum BetStatus {
    Open                = 1,
    Suspended           = 2,
    Settled             = 3
}

export enum UserLevel {
    Lv1                 = 1,
    Lv2                 = 2,
    Lv3                 = 3,
    Lv4                 = 4,
    Lv5                 = 5,
}

export enum MiniGameBetStatus {
    Pending             = 0,
    Win                 = 1,
    Lost                = 2,
    Refund              = 3
}

export enum IGameType {
    Sports              = "sports",
    MiniGame            = "minigame"
}

export enum SportsBetType {
    SINGLE              = 'single',
    MULTI               = 'multi'
}

export enum SportsBetStatus {
    PENDING             = 0,
    WIN                 = 1,
    LOSE                = 2,
    REFUND              = 3,
    // HALFWIN             = 4,
    // HALFLOSE            = 5,
    // CANCELED            = 6
}

export enum SportsType {
    PREMATCH            = "prematch",
    INPLAY              = "inplay"
}

export enum UserStatus {
    SUSPENDED           = 0,
    ACTIVE              = 1
}

export enum UserRole {
    Admin               = 'admin',
    User                = 'user'
}