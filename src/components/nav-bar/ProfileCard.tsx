import { Suspense } from "react"
import { unstable_noStore } from "next/cache"

import { getAuthUser, getDBUser } from "~/lib/auth/user"
import ClientProfileCard from "./ProfileCard.client"
import UserAvatar from "./UserAvatar"

async function ProfileCardImpl() {
  unstable_noStore()
  const user = await getAuthUser()
  const dbUser = user ? await getDBUser(user.id) : null
  return <ClientProfileCard user={dbUser} />
}

export function ProfileCard() {
  return (
    <Suspense fallback={<UserAvatar name={undefined} imageUrl={undefined} />}>
      <ProfileCardImpl />
    </Suspense>
  )
}
