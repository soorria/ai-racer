"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Play } from "lucide-react"
import { usePostHog } from "posthog-js/react"

import type { GameModeDetailsItem, GameModeIds, QuestionType } from "~/lib/games/constants"
import { createClientQuestionStrategy } from "~/lib/games/question-types/client_create"
import { api } from "~/lib/trpc/react"
import { cn } from "~/lib/utils"
import { AnimatedBorder } from "../ui/custom/animated-border"

type ExpandedCardProps = {
  mode: GameModeDetailsItem
  layoutId: string
}
const ExpandedCard = ({ mode, layoutId }: ExpandedCardProps) => {
  return (
    <motion.div
      layoutId={layoutId}
      className={"relative flex w-full flex-col rounded-2xl p-5 text-black sm:w-64"}
      style={{ backgroundColor: mode.color }}
      transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
    >
      <motion.div className="mb-1 flex items-center gap-2">
        <motion.div layoutId={`icon-${layoutId}`} className="absolute left-5 top-5">
          <mode.icon className="h-6 w-6" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="ml-8 text-xl font-medium"
        >
          {mode.title}
        </motion.h2>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="text-sm"
      >
        {mode.description}
      </motion.p>
    </motion.div>
  )
}

type CompactCardProps = {
  mode: GameModeDetailsItem
  layoutId: string
  isSelected: boolean
  isHighlighted: boolean
}
const CompactCard = ({ mode, layoutId, isSelected, isHighlighted }: CompactCardProps) => {
  return (
    <motion.div
      layoutId={layoutId}
      className={`relative flex h-16 w-16 items-center justify-center rounded-2xl text-black`}
      style={{ backgroundColor: mode.color }}
      animate={
        isHighlighted
          ? {
              scale: 1.2,
              boxShadow: "0 0 15px rgba(255,255,255,0.5)",
            }
          : {
              scale: isSelected ? 1.2 : 1,
              boxShadow: isSelected ? "0 0 25px rgba(255,255,255,0.8)" : "none",
            }
      }
      transition={{
        duration: 0.2,
        boxShadow: { duration: 0.1 },
      }}
    >
      <motion.div layoutId={`icon-${layoutId}`}>
        <mode.icon className="h-6 w-6" />
      </motion.div>
    </motion.div>
  )
}

type PlayButtonProps = {
  onClick: () => void
  isLoading: boolean
}
const PlayButton = ({ onClick, isLoading }: PlayButtonProps) => {
  return (
    <div className="fixed bottom-5 sm:static">
      <AnimatedBorder sizeMultiplier={5}>
        <motion.div
          className="z-10 flex h-24 w-24 items-center justify-center rounded-full bg-card ring-1 ring-gray-200/20"
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          whileTap={{ scale: 0.9 }}
        >
          <button
            className="flex h-full w-full items-center justify-center"
            onClick={onClick}
            disabled={isLoading}
          >
            <Play className="h-12 w-12 text-primary" />
          </button>
        </motion.div>
      </AnimatedBorder>
    </div>
  )
}

const GameModeSelectorAnimation = ({ questionType }: { questionType: QuestionType }) => {
  const questionStrategy = createClientQuestionStrategy(questionType)
  const router = useRouter()
  const posthog = usePostHog()

  const [isCompact, setIsCompact] = useState(false)
  const [showPlayButton, setShowPlayButton] = useState(true)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedMode, setSelectedMode] = useState<GameModeIds | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const joinGame = api.games.join.useMutation({
    onMutate() {
      posthog.capture("Joined game")
    },
    onSuccess: async ({ game_id, mode }) => {
      setIsSelecting(false)
      setHighlightedIndex(-1)
      setSelectedMode(mode)

      setTimeout(() => {
        router.push(`/games/play/${game_id}`)
      }, 500)
    },
  })

  useEffect(() => {
    let intervalId: NodeJS.Timeout
    if (isSelecting) {
      intervalId = setInterval(() => {
        setHighlightedIndex((prev) => (prev + 1) % questionStrategy.supportedGameModes.length)
      }, 200)
    }
    return () => clearInterval(intervalId)
  }, [questionStrategy.supportedGameModes.length, isSelecting])

  const handleClick = () => {
    setShowPlayButton(false)
    setIsCompact(true)

    setTimeout(() => {
      setIsSelecting(true)
      joinGame.mutate({ questionType })
    }, 500)
  }

  return (
    <div className="relative flex min-h-[500px] w-full select-none flex-col items-center justify-center sm:flex-row">
      <div className="mb-20 sm:absolute sm:mb-0">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            className={cn("grid grid-cols-1 gap-7", {
              "sm:grid-cols-4": !showPlayButton,
              "sm:grid-cols-2": showPlayButton,
            })}
            key={isCompact ? "compact" : "expanded"}
          >
            {questionStrategy.supportedGameModes.map((mode, index) =>
              isCompact ? (
                <CompactCard
                  key={`compact-${index}`}
                  mode={mode}
                  layoutId={`card-${index}`}
                  isSelected={selectedMode === mode.id}
                  isHighlighted={isSelecting && highlightedIndex === index}
                />
              ) : (
                <ExpandedCard key={`expanded-${index}`} mode={mode} layoutId={`card-${index}`} />
              ),
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {showPlayButton && <PlayButton onClick={handleClick} isLoading={joinGame.isPending} />}
      </AnimatePresence>
    </div>
  )
}

export default GameModeSelectorAnimation
