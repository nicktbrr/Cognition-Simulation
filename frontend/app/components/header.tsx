export default function Header({ name }: { name: string }) {
  return (
    <header className="text-center space-y-4">
      <h1 className="text-4xl font-bold">Welcome {name}!</h1>
      <h1 className="text-4xl font-bold">Simulating Human Cognition with AI</h1>
      <p className="text-muted-foreground max-w-4xl mx-auto">
        This platform offers an interactive tool for researchers to design their own cognitive processes and collect
        performance metrics. Below, you can (1) add sequence of inputs and outputs, (2) simulate the process with an
        LLM, and (3) download the raw data and metrics to assess quality, accuracy, and effectiveness. With subtle
        variations in design, researchers can conduct simulated experiments of cognitive processes, allowing for
        repeatable experiments that others can test and build upon. Together, we can advance a new science on human
        cognition.
      </p>
    </header>
  )
}

