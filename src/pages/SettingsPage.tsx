import AiModelPicker from '@/components/AiModelPicker';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">AI model</h2>
        <p className="text-sm text-muted-foreground">
          Used for document extraction, chat extraction (AI DataParse) and New Issue Bulletin generation.
          You can also switch it from inside each AI tool.
        </p>
        <AiModelPicker />
      </section>
    </div>
  );
}
