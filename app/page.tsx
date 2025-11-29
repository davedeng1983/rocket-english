import Link from 'next/link'
import { Rocket, Target, Brain, Zap, ChevronRight, CheckCircle2 } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 px-6 py-24 sm:py-32 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.100),white)] opacity-20" />
        <div className="absolute inset-y-0 right-1/2 -z-10 mr-16 w-[200%] origin-bottom-left skew-x-[-30deg] bg-white shadow-xl shadow-indigo-600/10 ring-1 ring-indigo-50 sm:mr-28 lg:mr-0 xl:mr-16 xl:origin-center" />
        
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-8 flex justify-center">
            <span className="relative rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-semibold leading-6 text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
              🚀 中考英语提分神器
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            每天1小时，<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              6个月冲刺中考满分
            </span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            告别题海战术。Rocket English 采用“测-诊-补-测”闭环学习模式，
            利用 AI 精准定位你的每一个知识漏洞，为你生成专属的提分计划。
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/study"
              className="group flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-500 hover:scale-105"
            >
              立即开始冲刺
              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link href="/dashboard" className="text-sm font-semibold leading-6 text-white hover:text-blue-300">
              进入仪表盘 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">核心方法论</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              闭环学习，科学提分
            </p>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              不再盲目刷题。我们将你的学习过程拆解为四个高效步骤，确保每一个小时的投入都有回报。
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              <Feature 
                icon={<Target className="h-6 w-6 text-white" />}
                title="周日：真题诊断"
                description="完成一套当周精选真题。系统自动判分，并强制进行错题归因，找出你的生词、语法和逻辑漏洞。"
              />
              <Feature 
                icon={<Brain className="h-6 w-6 text-white" />}
                title="周一至周五：智能补差"
                description="AI 根据你的漏洞生成每日 45 分钟的补短板任务。背单词、看微课、做专项，哪里不会补哪里。"
              />
              <Feature 
                icon={<Zap className="h-6 w-6 text-white" />}
                title="周六：变式验证"
                description="重做周日错题，并挑战系统生成的同类变式题。确保彻底消灭每一个知识盲区。"
              />
              <Feature 
                icon={<Rocket className="h-6 w-6 text-white" />}
                title="全程：可视化仪表盘"
                description="实时监控你的知识点掌握度。看着红色的漏洞一个个变绿，学习成就感满满。"
              />
            </dl>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:max-w-none">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                为什么选择 Rocket English？
              </h2>
            </div>
            <dl className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-3">
              <div className="flex flex-col bg-white p-8">
                <dt className="text-sm font-semibold leading-6 text-slate-600">覆盖真题</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900">100%</dd>
              </div>
              <div className="flex flex-col bg-white p-8">
                <dt className="text-sm font-semibold leading-6 text-slate-600">AI 个性化</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900">1-on-1</dd>
              </div>
              <div className="flex flex-col bg-white p-8">
                <dt className="text-sm font-semibold leading-6 text-slate-600">提分效率</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900">3x</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12">
        <div className="mx-auto max-w-7xl px-6 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
             <span className="text-slate-400 text-sm">© 2025 Rocket English. All rights reserved.</span>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <div className="flex items-center gap-2 text-white">
               <Rocket className="h-5 w-5" />
               <span className="font-bold">Rocket English</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="relative pl-16">
      <dt className="text-base font-semibold leading-7 text-slate-900">
        <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
          {icon}
        </div>
        {title}
      </dt>
      <dd className="mt-2 text-base leading-7 text-slate-600">{description}</dd>
    </div>
  )
}
