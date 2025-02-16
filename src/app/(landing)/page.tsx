import Link from "next/link"

import GameModeAnimation from "~/components/landing-page/GameModeAnimation"
import HeroAnimation from "~/components/landing-page/HeroAnimation"
import PatternBlobBackground from "~/components/landing-page/PatternBlobBackground"
import { Button } from "~/components/ui/button"
import { getAuthUser } from "~/lib/auth/user"

const PlayButtonIcon = () => {
  return (
    <svg width="14" height="16" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.5 3.29857L0.499999 16.7014C0.499998 19.0333 3.04392 20.4736 5.04349 19.2739L16.2125 12.5725C18.1546 11.4073 18.1546 8.59273 16.2125 7.42752L5.04349 0.726094C3.04392 -0.47365 0.5 0.966686 0.5 3.29857Z"
        fill="currentColor"
      ></path>
    </svg>
  )
}

export default async function Home() {
  const user = await getAuthUser()
  return (
    <div className="mt-10 sm:mt-28">
      <PatternBlobBackground />
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center sm:min-h-0 lg:grid lg:grid-cols-2 lg:gap-12 lg:gap-y-0">
          <div className="lg:flex lg:flex-col lg:justify-center">
            {/* Left column: Content */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:mb-0 sm:text-5xl">
                AI Powered
                <br /> Coding Battles
              </h1>
              <p className="mt-6 hidden text-lg leading-8 text-gray-300 sm:block">
                Put your AI prompting skills to the test in a <br className="lg:hidden" />
                game of speed and intelligence.
              </p>
            </div>

            {/* Buttons (appear with left content on desktop) */}
            <div className="hidden lg:mt-8 lg:flex lg:items-center lg:justify-start lg:gap-x-4">
              <Button asChild className="rounded-3xl">
                <Link href={user ? "/games/join" : "/auth/login"}>
                  <PlayButtonIcon />
                  Play Now
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link
                  href="/leaderboard"
                  className="group text-sm font-semibold leading-6 text-zinc-300"
                >
                  Leaderboard{" "}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Animation (second on mobile, right column on desktop) */}
          <div className="order-2 mt-8 flex flex-col items-center justify-center gap-y-9 lg:order-none lg:mt-0">
            <HeroAnimation />
            <GameModeAnimation questionType="programming" />
          </div>

          {/* Mobile-only buttons at bottom */}
          <div className="order-3 mt-8 flex w-full flex-col items-center justify-center gap-5 pb-8 sm:mt-10 lg:hidden">
            <Button asChild className="rounded-3xl">
              <Link href={user ? "/games/join" : "/auth/login"}>
                <PlayButtonIcon />
                Play Now
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link
                href="/leaderboard"
                className="group ml-2 text-sm font-semibold leading-6 text-zinc-300"
              >
                Leaderboard{" "}
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
