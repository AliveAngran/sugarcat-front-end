import './styles/globals.css'

export const metadata = {
  title: '订单管理系统',
  description: '糖猫订单管理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className="bg-gray-100">{children}</body>
    </html>
  )
}
