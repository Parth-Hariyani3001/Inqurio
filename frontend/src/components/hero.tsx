import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PaperExcerpt } from '@/components/paper-excerpt'

const steps = [
  {
    name: 'Find',
    body: 'Search by title, author, topic, or identifier. Open a paper when you know what you want to read.',
  },
  {
    name: 'Read',
    body: 'Stay with the full text. Citations, figures, and methods sit in one place so you can follow an argument through.',
  },
  {
    name: 'Ask',
    body: 'Select a passage and ask a question. Answers are tied to the words on the page, not a summary of the field.',
  },
]

export default function Hero() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16 lg:py-24">
        <div>
          <p className="text-muted-foreground text-sm tracking-wide">
            A reading room for papers
          </p>
          <h1 className="mt-4 max-w-xl font-serif text-4xl leading-[1.15] tracking-tight sm:text-5xl">
            Read the paper. Ask it back.
          </h1>
          <p className="mt-5 max-w-md text-muted-foreground text-base leading-relaxed sm:text-[1.05rem]">
            Inquiro is where you find research papers, read them in full, and
            ask questions that stay grounded in the text.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link className={buttonVariants({ size: 'lg' })} to="/sign-up/$">
              Create account
            </Link>
            <Link
              className={buttonVariants({ variant: 'ghost', size: 'lg' })}
              to="/sign-in/$"
            >
              Sign in
            </Link>
          </div>
        </div>
        <PaperExcerpt />
      </section>

      <Separator />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-muted-foreground text-sm tracking-wide">
          How you work
        </p>
        <h2 className="mt-3 max-w-lg font-serif text-3xl tracking-tight">
          From the library to the margin note
        </h2>
        <ol className="mt-12 flex flex-col">
          {steps.map((step, index) => (
            <li key={step.name}>
              {index > 0 ? <Separator /> : null}
              <div className="grid gap-3 py-8 sm:grid-cols-[8rem_minmax(0,32rem)] sm:gap-10">
                <p className="font-serif text-xl text-foreground">{step.name}</p>
                <p className="max-w-xl text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Separator />

      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-20">
        <div className="max-w-lg">
          <h2 className="font-serif text-3xl tracking-tight">
            Start with a paper you already mean to read
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Create an account to keep your library, return to passages, and
            continue questions you have already asked.
          </p>
        </div>
        <Link className={buttonVariants({ size: 'lg' })} to="/sign-up/$">
          Create account
        </Link>
      </section>
    </main>
  )
}
