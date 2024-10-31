import "dotenv/config";
/** Make sure dotenv comes first */
import path from "path";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { Translator } from "./lib/translator";
import fs from "fs";

const cli = yargs(hideBin(process.argv))
  .scriptName("i18n-translator")
  .command(
    "translate",
    "The translate command takes the content of the input file and translates it to the desired languages.",
    (yargs) => {
      return yargs
        .option("directory", {
          type: "string",
          demandOption: true,
        })
        .option("from", {
          type: "string",
          demandOption: true,
        })
        .option("to", {
          type: "string",
          demandOption: true,
        })
        .option("output", {
          type: "string",
        })
        .option("context", {
          type: "string",
        })
        .option("context-file", {
          type: "string",
        });
    },
    async (argv) => {
      /** Init translator */
      const translator = new Translator({
        directory: path.resolve(process.cwd(), argv.directory),
        output: argv.output
          ? path.resolve(process.cwd(), argv.output)
          : undefined,
      });

      /** Retrieve context */
      let context = argv.context ?? "";

      if (argv?.["context-file"]) {
        context = fs.readFileSync(
          path.resolve(process.cwd(), argv["context-file"]),
          "utf-8"
        );
      }

      /** Translate */
      const target_languages = argv.to.split(",");

      for (const target_language of target_languages) {
        await translator.translate({
          from: argv.from,
          to: target_language,
          context: context,
        });
      }
    }
  );

(async () => {
  const result = await cli.parseAsync();
})();
