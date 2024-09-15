import React from "react"
import BoringAvatar from "boring-avatars"

import { cn } from "~/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"

export default function UserAvatar({
  name,
  imageUrl,
  size = "sm",
}: {
  name: string | undefined
  imageUrl: string | undefined | null
  size?: "sm" | "md" | "lg"
}) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  }

  // Fancy line animation classes
  const lineClasses = cn(
    "absolute left-0 top-0 rotate-45 bg-white/70 blur-sm transition-transform duration-300",
    {
      "h-12 w-3 -translate-x-2 -translate-y-6 group-hover:translate-x-9 group-hover:translate-y-3":
        size === "sm",
      "h-20 w-4 -translate-x-4 -translate-y-12 group-hover:translate-x-16 group-hover:translate-y-5":
        size === "md",
      "h-32 w-4 -translate-x-2 -translate-y-14 group-hover:translate-x-28 group-hover:translate-y-5":
        size === "lg",
    },
  )

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-full transition-transform hover:shadow-xl",
      )}
    >
      <Avatar className={cn("rounded-full", sizeClasses[size])}>
        <AvatarImage
          src={imageUrl ?? undefined}
          alt={`${name}'s avatar`}
          className={"group-hover:scale-105"}
        />
        <AvatarFallback className="h-full w-full">
          <BoringAvatar name={name} variant="beam" />
        </AvatarFallback>
      </Avatar>
      <div className={lineClasses}></div>
    </div>
  )
}
