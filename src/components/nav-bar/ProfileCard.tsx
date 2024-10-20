import { Suspense } from "react"
import { unstable_noStore } from "next/cache"

import { getUserProfile } from "~/lib/auth/profile"
import { getAuthUser } from "~/lib/auth/user"
import { captureUserEvent } from "~/lib/posthog/server"
import ClientProfileCard from "./ProfileCard.client"
import UserAvatar from "./UserAvatar"

async function ProfileCardImpl() {
  unstable_noStore()
  const user = await getAuthUser()
  const dbUser = user ? await getUserProfile(user.id) : null

  captureUserEvent(user?.id ?? "test", "test-event")

  return <ClientProfileCard user={dbUser} />
}

export function ProfileCard() {
  return (
    <Suspense fallback={<UserAvatar name={undefined} imageUrl={undefined} />}>
      <ProfileCardImpl />
    </Suspense>
  )
}
