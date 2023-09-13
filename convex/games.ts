import "@total-typescript/ts-reset"
import {
  QueryCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import { api, internal } from "./_generated/api"

import { v } from "convex/values"
import { getUser, requireUser } from "./utils/auth"
import ms from "ms"
import { addMilliseconds } from "date-fns"
import { Id } from "./_generated/dataModel"

export const getMyGames = query({
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)

    const gameInfos = await ctx.db
      .query("playerGameInfo")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .take(20)

    const games = await Promise.all(gameInfos.map((info) => ctx.db.get(info.gameId)))

    return { games: games.filter(Boolean) }
  },
})

const _getLatestActiveGameForUser = async (ctx: QueryCtx, userId: string) => {
  const [latestGameInfoForUser] = await ctx.db
    .query("playerGameInfo")
    .filter((q) => q.eq(q.field("userId"), userId))
    .order("desc")
    .take(1)

  if (!latestGameInfoForUser) {
    return null
  }

  const game = await ctx.db.get(latestGameInfoForUser.gameId)

  const state = game?.state

  if (!game || state === "finished" || state === "cancelled") {
    return null
  }

  return {
    ...game,
    state: state!,
  }
}

export const getLatestActiveGameForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return _getLatestActiveGameForUser(ctx, args.userId)
  },
})

export const getLatestActiveGameForAuthedUser = query({
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    return _getLatestActiveGameForUser(ctx, userId)
  },
})

export const createNewGame = internalMutation({
  args: { creatorUserId: v.string() },
  handler: async (ctx, args) => {
    const gameId = await ctx.db.insert("game", {
      creatorId: args.creatorUserId,
      mode: "fastest-player",
      state: "waiting-for-players",
      question: {
        description: "Do le two sum",
      },
      gameStartTime: addMilliseconds(new Date(), GAME_TIMINGS.waitingForPlayers).toISOString(),
      gameEndTime: addMilliseconds(
        new Date(),
        GAME_TIMINGS.waitingForPlayers + GAME_TIMINGS.playTime
      ).toISOString(),
    })

    return { gameId }
  },
})

export const getGame = query({
  args: { gameId: v.string() },
  handler: async (ctx, args) => {
    const gameId = ctx.db.normalizeId("game", args.gameId)
    if (!gameId) return null
    const game = await ctx.db.get(gameId)

    return game
  },
})

export const patchGameState = internalMutation({
  args: {
    gameId: v.id("game"),
    state: v.union(
      v.literal("waiting-for-players"),
      v.literal("in-progress"),
      v.literal("finished")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      state: args.state,
    })
  },
})

export const advanceGameState = internalAction({
  args: { gameId: v.id("game") },
  handler: async (ctx, args) => {
    const game = await ctx.runQuery(api.games.getGame, { gameId: args.gameId })

    if (!game) {
      return
    }

    if (game.state === "waiting-for-players") {
      await ctx.runMutation(internal.games.patchGameState, {
        gameId: args.gameId,
        state: "in-progress",
      })
      await ctx.scheduler.runAfter(GAME_TIMINGS.playTime, internal.games.advanceGameState, args)
    } else if (game.state === "in-progress") {
      await ctx.runMutation(internal.games.patchGameState, {
        gameId: args.gameId,
        state: "finished",
      })
    }
  },
})

const GAME_TIMINGS = {
  waitingForPlayers: ms("10s"),
  playTime: ms("10s"),
}

export const createGame = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const newGameResult = await ctx.runMutation(internal.games.createNewGame, {
      creatorUserId: args.userId,
    })

    // schedule advancing
    await ctx.scheduler.runAfter(GAME_TIMINGS.waitingForPlayers, internal.games.advanceGameState, {
      gameId: newGameResult.gameId,
    })

    const gameId = newGameResult.gameId as Id<"game">

    return { gameId }
  },
})

export const cancelGame = mutation({
  args: {
    gameId: v.id("game"),
  },

  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)

    const game = await ctx.db.get(args.gameId)
    if (!game) {
      throw new Error("Game not found")
    }

    if (game.creatorId !== userId) {
      throw new Error("Only the creator can cancel the game")
    }

    if (game.state !== "waiting-for-players") {
      throw new Error("Game cannot be cancelled in this state")
    }

    await ctx.db.patch(args.gameId, {
      state: "cancelled",
    })
  },
})

export const getWaitingGames = query({
  handler: async (ctx) => {
    const games = await ctx.db
      .query("game")
      .filter((q) => q.eq(q.field("state"), "waiting-for-players"))
      .order("desc")
      .take(20)

    return games
  },
})

export const joinGame = action({
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)

    const currentGame = await ctx.runQuery(internal.games.getLatestActiveGameForUser, { userId })
    if (currentGame) {
      throw new Error("You're already in an active game")
    }

    const games = await ctx.runQuery(api.games.getWaitingGames)
    let gameToJoin = games[Math.floor(Math.random() * games.length)]

    if (!gameToJoin) {
      const { gameId } = await ctx.runAction(internal.games.createGame, {
        userId,
      })
      const newGame = await ctx.runQuery(api.games.getGame, { gameId })
      if (!newGame) {
        throw new Error("Failed to create game")
      }
      gameToJoin = newGame
    }

    // this is to get around the types being a little dumb :(
    const gameId = gameToJoin._id as Id<"game">

    await ctx.runMutation(internal.games.createPlayerInfoForGame, {
      gameId,
      userId,
      startingCode: "",
    })

    return { gameId }
  },
})

export const createPlayerInfoForGame = internalMutation({
  args: {
    gameId: v.id("game"),
    userId: v.string(),
    startingCode: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("playerGameInfo", {
      gameId: args.gameId,
      userId: args.userId,
      state: "playing",
      code: args.startingCode,
      chatHistory: [],
    })
  },
})
