import './globals.css'

export const metadata = {
  title: 'TeamBoard',
  description: 'Collaborative task and discussion board',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
