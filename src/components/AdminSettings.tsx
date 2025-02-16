import React from "react"
import { useRouter } from "next/navigation"
import { usePostHog } from "posthog-js/react"

import type { QuestionDifficultyLevels, QuestionType } from "~/lib/games/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { QUESTION_DIFFICULTY_LEVELS } from "~/lib/games/constants"
import { api } from "~/lib/trpc/react"
import { Button } from "./ui/button"

type Props = { gameId?: string }

type ForceGameStatusChange = "waitingForPlayers" | "inProgress" | "finished"

export default function AdminSettings({ gameId }: Props) {
  const router = useRouter()
  const posthog = usePostHog()
  const trpcUtils = api.useUtils()
  const joinGame = api.games.join.useMutation({
    onMutate() {
      posthog.capture("Joined game")
    },
    onSuccess: async ({ game_id }) => {
      router.push(`/games/play/${game_id}`)
    },
  })
  const forceStateChangeMutation = api.games.forceProgressGameState.useMutation({
    onSuccess: () => {
      void trpcUtils.games.getGameStateWithQuestion.invalidate()
    },
  })

  const [difficulty, setDifficulty] = React.useState<QuestionDifficultyLevels>("easy")
  const [questionType, setQuestionType] = React.useState<QuestionType>("programming")
  const [gameState, setGameState] = React.useState<ForceGameStatusChange>("waitingForPlayers")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Select
            onValueChange={(type: QuestionType) => setQuestionType(type)}
            defaultValue="programming"
          >
            <SelectTrigger className="w-full flex-1">
              <SelectValue placeholder="Question Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="programming">Programming</SelectItem>
              <SelectItem value="picture">Picture</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(a: QuestionDifficultyLevels) => setDifficulty(a)}
            defaultValue="easy"
          >
            <SelectTrigger className="w-full flex-1">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_DIFFICULTY_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            joinGame.mutate({ questionType, difficulty })
          }}
          className="w-full"
        >
          Join {questionType} game
        </Button>
      </div>
      {gameId && (
        <div className="flex gap-2">
          Change game state
          <Select
            onValueChange={(a: ForceGameStatusChange) => setGameState(a)}
            defaultValue="waitingForPlayers"
          >
            <SelectTrigger className="w-full flex-1">
              <SelectValue placeholder="Game state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="waitingForPlayers">Waiting for players</SelectItem>
              <SelectItem value="inProgress">In progress</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              forceStateChangeMutation.mutate({ game_id: gameId, game_state: gameState })
            }}
          >
            Change state
          </Button>
        </div>
      )}
    </div>
  )
}
