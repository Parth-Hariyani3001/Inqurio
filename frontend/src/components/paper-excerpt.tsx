export function PaperExcerpt() {
  return (
    <figure className="border border-border bg-card p-6 text-card-foreground sm:p-8">
      <figcaption className="flex items-baseline justify-between gap-4 text-muted-foreground text-xs tracking-wide">
        <span>Methods · sample</span>
        <span className="font-mono">arXiv:2403.11208</span>
      </figcaption>
      <h2 className="mt-4 font-serif text-xl text-foreground tracking-tight sm:text-2xl">
        Estimating treatment effects under delayed enrollment
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Chen, Okonkwo, and Ramírez
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <p className="font-serif text-base text-foreground/90 leading-[1.7] sm:text-[1.05rem]">
          Participants were recruited from three outpatient clinics between
          March 2019 and January 2021. We excluded records with missing
          baseline labs and those enrolled after the protocol amendment.{' '}
          <mark className="bg-accent text-accent-foreground">
            The analytic sample therefore omits 18% of otherwise eligible
            patients, concentrated in the later months of recruitment.
          </mark>{' '}
          Sensitivity analyses reintroduce these cases under two missingness
          assumptions.
        </p>
        <aside className="border-t border-border pt-4 text-sm lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
          <p className="text-muted-foreground text-xs tracking-wide">
            Question
          </p>
          <p className="mt-2 font-serif text-foreground leading-snug">
            Who is missing from the later months, and does that change the
            reported effect?
          </p>
        </aside>
      </div>
    </figure>
  )
}
