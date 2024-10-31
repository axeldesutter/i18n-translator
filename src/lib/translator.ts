import fs from "node:fs";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";

// Initialize OpenAI API
const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

export class Translator {
  private directory: string;
  private output_directory: string | undefined;
  private translations_files: Array<TranslationsFile>;

  constructor(args: { directory: string; output: string | undefined }) {
    this.directory = args.directory;
    this.output_directory = args.output;
    this.translations_files = [];
  }

  public translate = async (args: TranslateFunctionArgument) => {
    /** Find all input files */
    const explore_directory = (path: string) => {
      const files = fs.readdirSync(path);
      files.forEach((file) => {
        const file_path = `${path}/${file}`;
        if (fs.lstatSync(file_path).isDirectory()) {
          explore_directory(file_path);
        } else {
          const file_content = fs.readFileSync(file_path, "utf8");
          try {
            this.translations_files.push({
              path: file_path,
              input: JSON.parse(file_content),
              output: null,
            });
          } catch (e) {}
        }
      });
    };

    /** Find all translation files */
    explore_directory(this.directory + `/${args.from}`);

    /** Prepare ouput directory */
    let output_directory = this.directory + `/${args.to}`;

    if (this.output_directory) {
      output_directory = this.output_directory;
    }

    if (!fs.existsSync(output_directory)) {
      fs.mkdirSync(output_directory);
    }

    const translations_promises = this.translations_files.map(
      (translations_file) => {
        return async () => {
          /** Translate file content */
          const translated_content = await this.translate_file_content({
            ...args,
            content: translations_file.input,
          });

          console.log(
            `Successfully translated ${translations_file.path
              .split("/")
              .pop()} from ${args.from} to ${args.to}`
          );

          this.translations_files = this.translations_files.map((file) => {
            if (file.path === translations_file.path)
              file.output = translated_content;
            return file;
          });
        };
      }
    );

    await Promise.all(translations_promises.map((p) => p()));

    // for (const translations_file of this.translations_files) {
    //   /** Translate file content */
    //   const translated_content = await this.translate_file_content({
    //     ...args,
    //     content: translations_file.input,
    //   });

    //   console.log(
    //     `Successfully translated ${translations_file.path
    //       .split("/")
    //       .pop()} from ${args.from} to ${args.to}`
    //   );

    //   this.translations_files = this.translations_files.map((file) => {
    //     if (file.path === translations_file.path)
    //       file.output = translated_content;
    //     return file;
    //   });
    // }

    /** Save translations to output directory */
    for (const translations_file of this.translations_files) {
      const file_name = translations_file.path.split("/").pop();

      fs.writeFileSync(
        `${output_directory}/${file_name}`,
        JSON.stringify(translations_file.output, null, 2)
      );
    }
  };

  private translate_file_content = async (
    args: TranslateFunctionArgument & { content: Record<string, unknown> }
  ) => {
    /** Basic prompt */
    const prompt = `
    ${args.context ? `Respect the following context: ${args.context}\n\n` : ``}

    When or if you find somewhere text under <>, {{}} or [], do not translate it. For example, hello <bold>world</bold> should become bonjour <bold>le monde</bold>.
    \n\n

    Translate the following JSON content from ${args.from} to ${
      args.to
    } while keeping the structure intact. It is extremely important that you only respond with json:\n\n
    ${JSON.stringify(args.content, null, 2)}`;

    /** Translate content */
    const response = await client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "chatgpt-4o-latest",
    });

    /** Parse response */
    let translated_content = {};

    try {
      /** Keep only what seems like json, i.e. what's between the highest level {} */
      const json = (response.choices[0].message.content ?? "{}").match(
        /\{([^)]+)\}/
      );

      if (json) {
        const repaired_json = jsonrepair(json[0]);
        translated_content = JSON.parse(repaired_json);
      }
    } catch (e) {
      console.log(e);
    }

    return translated_content;
  };
}

type TranslationsFile = {
  path: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
};

type TranslateFunctionArgument = {
  from: string;
  to: string;
  context?: string;
};
