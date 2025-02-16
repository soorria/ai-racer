import React from "react"

import GameModeSelectorAnimation from "~/components/join-game/GameModeSelectorAnimation"

export default function JoinGame() {
  return (
    <>
      <div className="mx-auto my-8 max-w-2xl text-center lg:max-w-none">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Join a Game!</h2>
        <p className="mt-4 text-lg leading-8 text-zinc-400">
          Jump into a random game mode and put your prompting skills to the test!
        </p>
      </div>
      <GameModeSelectorAnimation questionType="programming" />
    </>
  )
}
