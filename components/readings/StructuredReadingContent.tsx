import {
  parseReadingContent,
  type StructuredReadingBlock,
} from "@/lib/readings/structuredReading";

type StructuredReadingContentProps = {
  content: string | null;
  emptyMessage?: string;
};

function ReadingBlock({
  block,
  index,
}: {
  block: StructuredReadingBlock;
  index: number;
}) {
  if (block.type === "heading") {
    return (
      <h3 className="font-sans text-2xl font-bold leading-tight text-[#102A43]">
        {block.text}
      </h3>
    );
  }

  if (block.type === "subheading") {
    return (
      <h4 className="border-l-4 border-[#E8B017] pl-3 font-sans text-lg font-bold leading-snug text-[#9A6A00]">
        {block.text}
      </h4>
    );
  }

  if (block.type === "paragraph") {
    return <p className="whitespace-pre-wrap break-words">{block.text}</p>;
  }

  if (block.type === "bulletList" || block.type === "numberedList") {
    const ListElement = block.type === "bulletList" ? "ul" : "ol";
    return (
      <ListElement
        className={`space-y-2 pl-6 ${
          block.type === "bulletList" ? "list-disc" : "list-decimal"
        }`}
      >
        {block.items.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}-${item.slice(0, 24)}`}>{item}</li>
        ))}
      </ListElement>
    );
  }

  if (block.type === "definition") {
    return (
      <aside className="rounded-2xl border border-[#E8B017]/40 bg-amber-50 p-4">
        <p className="font-sans text-sm font-bold uppercase tracking-wide text-[#9A6A00]">
          {block.term}
        </p>
        <p className="mt-2">{block.definition}</p>
      </aside>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-collapse text-left font-sans text-sm">
        <thead className="bg-[#102A43] text-white">
          <tr>
            {block.headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap px-4 py-3 font-bold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr
              key={`${rowIndex}-${row.join("-")}`}
              className="border-t border-slate-200 even:bg-slate-50"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={`${cellIndex}-${cell}`}
                  className="min-w-36 px-4 py-3 align-top"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StructuredReadingContent({
  content,
  emptyMessage = "No reading content is available.",
}: StructuredReadingContentProps) {
  const parsed = parseReadingContent(content);

  if (parsed.kind === "malformed") {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Structured reading could not be parsed. Raw content was hidden.",
      );
    }
    return (
      <p className="text-sm text-red-700">
        This reading could not be displayed correctly.
      </p>
    );
  }

  if (parsed.kind === "empty") {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-5 font-serif text-[15px] leading-8 text-slate-700 sm:text-base">
      {parsed.blocks.map((block, index) => (
        <ReadingBlock
          key={`${index}-${block.type}`}
          block={block}
          index={index}
        />
      ))}
    </div>
  );
}
