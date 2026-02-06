import { env } from "@crikket/env/web"

export const siteConfig = {
  name: "Crikket",
  title: "Crikket",
  description:
    "Modern instant bug reporting platform. An open-source alternative to jam.dev and marker.io.",
  url: env.NEXT_PUBLIC_APP_URL,
}
