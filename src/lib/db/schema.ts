import type { SQL } from "drizzle-orm"
import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { authenticatedRole, authUid } from "drizzle-orm/supabase"

import { GAME_MODES } from "../games/constants"
import { type GameEvent } from "../games/events/schema"
import { type ChatHistoryItemContent } from "../games/schemas"
import { type ModelId } from "../llm/constants"

const customTypes = {
  primaryKey: () => uuid().primaryKey().defaultRandom().notNull(),
  primaryKeyWithoutDefault: () => uuid().primaryKey().notNull(),
  primaryKeyReference: () => uuid(),
}

export const roleEnum = pgEnum("role", ["admin", "user"])

export const userProfiles = pgTable(
  "users",
  {
    /**
     * Supabase auth user id
     */
    id: customTypes.primaryKeyWithoutDefault(),
    name: text("name").notNull(),
    profile_image_url: text("profile_image_url"),
    role: roleEnum("role").default("user").notNull(),

    github_username: text("github_username"),

    wins: integer("wins").default(0).notNull(),
    gamesPlayed: integer("games_played").default(0).notNull(),
    winRate: real("win_rate").generatedAlwaysAs(
      (): SQL =>
        sql`case when ${userProfiles.gamesPlayed} = 0 then 0 else least((${userProfiles.wins}::real / ${userProfiles.gamesPlayed}), 1.0) end`,
    ),

    inserted_at: timestamp("inserted_at").notNull().defaultNow(),
  },
  (table) => [
    index().on(table.wins.desc(), table.gamesPlayed.asc(), table.inserted_at.desc()).concurrently(),

    index().on(table.gamesPlayed.desc(), table.inserted_at.desc()).concurrently(),

    index().on(table.winRate.desc(), table.wins.desc(), table.inserted_at.desc()).concurrently(),
  ],
).enableRLS()

export const usersRelations = relations(userProfiles, ({ many }) => {
  return {
    gameSessions: many(playerGameSessions),
  }
})

export const programmingQuestionSourceTypeEnum = pgEnum("programming_question_source_type", ["ai"])

export const programmingQuestionSources = pgTable("programming_question_sources", {
  id: customTypes.primaryKey(),
  type: programmingQuestionSourceTypeEnum("type").notNull(),
  link: text("link"),
}).enableRLS()

export const programmingQuestionSourcesRelations = relations(
  programmingQuestionSources,
  ({ many }) => {
    return {
      programmingQuestions: many(programmingQuestions),
    }
  },
)

export const programmingQuestionTestCaseTypeEnum = pgEnum("programming_question_test_case_type", [
  "hidden",
  "public",
])

export const programmingQuestionTestCases = pgTable(
  "programming_question_test_cases",
  {
    id: customTypes.primaryKey(),
    programming_question_id: customTypes
      .primaryKeyReference()
      .notNull()
      .references(() => programmingQuestions.id, {
        onDelete: "cascade",
      }),
    type: programmingQuestionTestCaseTypeEnum("type").notNull(),
    args: jsonb("args").notNull().$type<unknown[]>(),
    expectedOutput: jsonb("expected_output").$type<unknown>(),
  },
  (table) => [index().on(table.programming_question_id).concurrently()],
).enableRLS()

export const programmingQuestionTestCasesRelations = relations(
  programmingQuestionTestCases,
  ({ one }) => {
    return {
      programmingQuestion: one(programmingQuestions, {
        fields: [programmingQuestionTestCases.programming_question_id],
        references: [programmingQuestions.id],
      }),
    }
  },
)

export const questionDifficultyEnum = pgEnum("question_difficulty", ["easy", "medium", "hard"])

export const pictureQuestions = pgTable("picture_question", {
  id: customTypes.primaryKey(),
}).enableRLS()

export const programmingQuestions = pgTable("programming_question", {
  id: customTypes.primaryKey(),

  starterCode: text("starter_code").notNull(),
  source_id: customTypes
    .primaryKeyReference()
    .notNull()
    .references(() => programmingQuestionSources.id),

  title: text("title").notNull(),
  description: text("description").notNull(),
}).enableRLS()

export const programmingQuestionsRelations = relations(programmingQuestions, ({ one, many }) => {
  return {
    source: one(programmingQuestionSources, {
      fields: [programmingQuestions.source_id],
      references: [programmingQuestionSources.id],
    }),
    testCases: many(programmingQuestionTestCases),
  }
})

export const questions = pgTable(
  "questions",
  {
    id: customTypes.primaryKey(),
    difficulty: questionDifficultyEnum("difficulty").notNull(),

    programming_question_id: customTypes
      .primaryKeyReference()
      .references(() => programmingQuestions.id, {
        onDelete: "cascade",
      }),

    picture_question_id: customTypes.primaryKeyReference().references(() => pictureQuestions.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    check(
      "question_reference_check",
      sql`num_nonnulls(${table.programming_question_id}, ${table.picture_question_id}) = 1`,
    ),
  ],
).enableRLS()

export const questionsRelations = relations(questions, ({ one, many }) => {
  return {
    programmingQuestion: one(programmingQuestions, {
      fields: [questions.programming_question_id],
      references: [programmingQuestions.id],
    }),

    pictureQuestion: one(pictureQuestions, {
      fields: [questions.picture_question_id],
      references: [pictureQuestions.id],
    }),

    gameStates: many(gameStates),
  }
})

export const playerGameSessionFinalResults = pgTable(
  "player_game_session_final_results",
  {
    id: customTypes.primaryKey(),
    player_game_session_id: customTypes
      .primaryKeyReference()
      .notNull()
      .unique()
      .references(() => playerGameSessions.id, {
        onDelete: "cascade",
      }),
    position: integer("position").notNull(),
    score: integer("score").notNull(),
  },
  (table) => [index().on(table.player_game_session_id).concurrently()],
).enableRLS()

export const playerGameSessionFinalResultsRelations = relations(
  playerGameSessionFinalResults,
  ({ one }) => {
    return {
      playerGameSession: one(playerGameSessions, {
        fields: [playerGameSessionFinalResults.player_game_session_id],
        references: [playerGameSessions.id],
      }),
    }
  },
)

export const playerPictureGameSubmissionStateResults = pgTable(
  "player_picture_game_submission_state_results",
  {
    id: customTypes.primaryKey(),

    player_game_submission_state_id: customTypes
      .primaryKeyReference()
      .notNull()
      .references(() => playerGameSubmissionStates.id, {
        onDelete: "cascade",
      }),

    error_message: text("error_message"),

    match_percentage: real("match_percentage").notNull(),
  },
).enableRLS()

export const playerPictureGameSubmissionStateResultsRelations = relations(
  playerPictureGameSubmissionStateResults,
  ({ one }) => {
    return {
      playerGameSubmissionState: one(playerGameSubmissionStates, {
        fields: [playerPictureGameSubmissionStateResults.player_game_submission_state_id],
        references: [playerGameSubmissionStates.id],
      }),
    }
  },
)

export const playerProgrammingGameSubmissionStateResultStatusEnum = pgEnum(
  "player_game_submission_state_result_status",
  ["success", "error"],
)

export const playerProgrammingGameSubmissionStateResults = pgTable(
  "player_programming_game_submission_state_results",
  {
    id: customTypes.primaryKey(),
    player_game_submission_state_id: customTypes
      .primaryKeyReference()
      .notNull()
      .references(() => playerGameSubmissionStates.id, {
        onDelete: "cascade",
      }),
    programming_question_test_case_id: customTypes
      .primaryKeyReference()
      .references(() => programmingQuestionTestCases.id, {
        onDelete: "set null",
      }),
    status: playerProgrammingGameSubmissionStateResultStatusEnum("status").notNull(),
    result: jsonb("result"),
    reason: text("reason"),
    is_correct: boolean("is_correct").notNull(),
    run_duration_ms: integer("runDurationMs").notNull(),
  },
  (table) => [index().on(table.player_game_submission_state_id).concurrently()],
).enableRLS()

export const playerProgrammingGameSubmissionStateResultsRelations = relations(
  playerProgrammingGameSubmissionStateResults,
  ({ one }) => {
    return {
      playerGameSubmissionState: one(playerGameSubmissionStates, {
        fields: [playerProgrammingGameSubmissionStateResults.player_game_submission_state_id],
        references: [playerGameSubmissionStates.id],
      }),
    }
  },
)

export const playerGameSubmissionStateSubmissionTypeEnum = pgEnum(
  "player_game_submission_state_submission_type",
  ["test-run", "submission"],
)

export const playerGameSubmissionStateStatusEnum = pgEnum("player_game_submission_state_status", [
  "running",
  "complete",
])

export const playerGameSubmissionStates = pgTable(
  "player_game_submission_states",
  {
    id: customTypes.primaryKey(),
    player_game_session_id: customTypes
      .primaryKeyReference()
      .references(() => playerGameSessions.id, {
        onDelete: "cascade",
      })
      .notNull(),
    submission_type: playerGameSubmissionStateSubmissionTypeEnum("submission_type").notNull(),
    last_submitted_at: timestamp("last_submitted_at").notNull(),
    status: playerGameSubmissionStateStatusEnum("status").notNull(),
  },
  (table) => [index().on(table.player_game_session_id).concurrently()],
).enableRLS()

export const playerGameSubmissionStatesRelations = relations(
  playerGameSubmissionStates,
  ({ one, many }) => {
    return {
      playerGameSession: one(playerGameSessions, {
        fields: [playerGameSubmissionStates.player_game_session_id],
        references: [playerGameSessions.id],
      }),
      programmingResults: many(playerProgrammingGameSubmissionStateResults),
      pictureResult: one(playerPictureGameSubmissionStateResults, {
        fields: [playerGameSubmissionStates.id],
        references: [playerPictureGameSubmissionStateResults.player_game_submission_state_id],
      }),
    }
  },
)

export const playerGameSessionChatHistoryItems = pgTable(
  "player_game_session_chat_history_items",
  {
    id: customTypes.primaryKey(),
    player_game_session_id: customTypes
      .primaryKeyReference()
      .notNull()
      .references(() => playerGameSessions.id, {
        onDelete: "cascade",
      }),
    content: jsonb("content").notNull().$type<ChatHistoryItemContent>(),
    inserted_at: timestamp("inserted_at").notNull().defaultNow(),
  },
  (table) => [
    index().on(table.player_game_session_id).concurrently(),
    index().on(table.inserted_at.asc()).concurrently(),
  ],
).enableRLS()

export const playerGameSessionChatHistoryItemsRelations = relations(
  playerGameSessionChatHistoryItems,
  ({ one }) => {
    return {
      playerGameSession: one(playerGameSessions, {
        fields: [playerGameSessionChatHistoryItems.player_game_session_id],
        references: [playerGameSessions.id],
      }),
    }
  },
)

export const playerGameSessions = pgTable(
  "player_game_sessions",
  {
    id: customTypes.primaryKey(),
    user_id: customTypes
      .primaryKeyReference()
      .notNull()
      .references(() => userProfiles.id, {
        onDelete: "cascade",
      }),
    game_id: customTypes
      .primaryKeyReference()
      .notNull()
      .references(() => gameStates.id, {
        onDelete: "cascade",
      }),

    test_state_id: customTypes.primaryKeyReference(),
    submission_state_id: customTypes.primaryKeyReference(),

    model: text("string").notNull().$type<ModelId>(),

    code: text("code").notNull(),
    last_prompted_at: timestamp("last_prompted_at"),

    final_result_id: customTypes.primaryKeyReference(),

    updated_at: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index().on(table.user_id, table.game_id).concurrently(),
    index().on(table.game_id).concurrently(),
    pgPolicy("Players can read their own sessions", {
      as: "permissive",
      to: "public",
      for: "select",
      using: sql`
(select auth.uid() as uid) = player_game_sessions.user_id
`,
    }),
  ],
).enableRLS()

export const playerGameSessionsRelations = relations(playerGameSessions, ({ one, many }) => {
  return {
    chatHistory: many(playerGameSessionChatHistoryItems),
    testState: one(playerGameSubmissionStates, {
      fields: [playerGameSessions.test_state_id],
      references: [playerGameSubmissionStates.id],
    }),
    submissionState: one(playerGameSubmissionStates, {
      fields: [playerGameSessions.submission_state_id],
      references: [playerGameSubmissionStates.id],
    }),
    finalResult: one(playerGameSessionFinalResults),
    user: one(userProfiles, {
      fields: [playerGameSessions.user_id],
      references: [userProfiles.id],
    }),
    game: one(gameStates, {
      fields: [playerGameSessions.game_id],
      references: [gameStates.id],
    }),
  }
})

export const gameStatusEnum = pgEnum("game_state", [
  "waitingForPlayers",
  "inProgress",
  "finalising",
  "finished",
  "cancelled",
])

export const gameModeEnum = pgEnum("game_mode", GAME_MODES)

export const gameStates = pgTable(
  "game_states",
  {
    id: customTypes.primaryKey(),
    question_id: customTypes
      .primaryKeyReference()
      .notNull()
      .references(() => questions.id),
    status: gameStatusEnum("status").notNull(),
    mode: gameModeEnum("mode").notNull(),

    waiting_for_players_duration_ms: integer("waiting_for_players_duration_ms").notNull(),
    in_progress_duration_ms: integer("in_progress_duration_ms").notNull(),

    inserted_at: timestamp("inserted_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    start_time: timestamp("start_time"),
    end_time: timestamp("end_time"),
  },
  (table) => [
    index().on(table.status),
    pgPolicy("Players can read game states they're a part of", {
      as: "permissive",
      to: "public",
      for: "select",
      using: sql`
(select auth.uid() as uid) IN
(
  select player_game_sessions.user_id
  from player_game_sessions
  where player_game_sessions.game_id = game_states.id
)
`,
    }),
  ],
).enableRLS()

export const gameStatesRelations = relations(gameStates, ({ one, many }) => {
  return {
    question: one(questions, {
      fields: [gameStates.question_id],
      references: [questions.id],
    }),
    players: many(playerGameSessions),
  }
})

export const gameEvents = pgTable(
  "game_events",
  {
    id: customTypes.primaryKey(),

    game_id: customTypes
      .primaryKeyReference()
      .notNull()
      .references(() => gameStates.id, {
        onDelete: "cascade",
      }),

    /**
     * The user to sent the event to.
     *
     * If `null`, send to all users in a game
     */
    user_id: customTypes.primaryKeyReference().references(() => userProfiles.id, {
      onDelete: "set null",
    }),

    payload: jsonb().notNull().$type<GameEvent>(),

    inserted_at: timestamp().notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("Users can read events not tied to a user", {
      as: "permissive",
      to: authenticatedRole,
      for: "select",
      using: sql`
(
  ${authUid} IN
  (
    select ${playerGameSessions.user_id}
    from ${playerGameSessions}
    where ${playerGameSessions.game_id} = ${t.game_id}
  )
) and (
  ${t.user_id} is NULL
)
`,
    }),
    pgPolicy("Users can read their own events", {
      as: "permissive",
      to: authenticatedRole,
      for: "select",
      using: sql`${authUid} = ${t.user_id}`,
    }),
  ],
).enableRLS()
