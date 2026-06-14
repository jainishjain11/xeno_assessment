import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-10" />

  const getBtnClass = (btnTheme: string) => {
    if (theme === btnTheme) {
      return "bg-white text-blue-600 border border-blue-200 shadow-sm dark:bg-blue-500/20 dark:text-blue-500 dark:border-blue-500/30"
    }
    return "text-slate-400 hover:text-slate-500 hover:bg-white border border-transparent dark:text-slate-500 dark:hover:text-slate-400 dark:hover:bg-white/5"
  }

  return (
    <div className="flex gap-0.5 rounded-[10px] p-1 bg-slate-100 border border-slate-200 dark:bg-white/5 dark:border-white/[0.08] w-fit mx-auto sm:mx-0">
      <button
        onClick={() => setTheme("light")}
        title="Light"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${getBtnClass("light")}`}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        title="System"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${getBtnClass("system")}`}
      >
        <Monitor className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        title="Dark"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${getBtnClass("dark")}`}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  )
}
