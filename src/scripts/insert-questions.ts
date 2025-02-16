import { readFile } from "fs/promises"
import crypto from "node:crypto"
import { invariant } from "@epic-web/invariant"
import { createInsertSchema } from "drizzle-zod"
import { slugify } from "inngest"
import { z } from "zod"

import { cmp, db, schema } from "~/lib/db"
import { type DocInsert } from "~/lib/db/types"

const QuestionDocSchema = createInsertSchema(schema.questions, {})
const ProgrammingQuestionDocSchema = createInsertSchema(schema.programmingQuestions, {})
const ProgrammingQuestionTestCaseDocSchema = createInsertSchema(
  schema.programmingQuestionTestCases,
  {
    args: z.unknown().array(),
    expectedOutput: z.unknown().refine((v) => v !== null && v !== undefined),
  },
)

const QuestionSchema = QuestionDocSchema.omit({
  id: true,
})
  .and(
    z.object({
      testCases: ProgrammingQuestionTestCaseDocSchema.omit({
        programming_question_id: true,
        id: true,
        type: true,
      })
        .array()
        .min(5),
    }),
  )
  .and(
    ProgrammingQuestionDocSchema.omit({
      id: true,
      source_id: true,
    }),
  )

const QuestionJSONFileSchema = z.array(QuestionSchema)

function getDbDocuments(args: { question: z.infer<typeof QuestionSchema>; source_id: string }): {
  questionSlug: string
  question: DocInsert<"questions"> & { programmingQuestion: DocInsert<"programmingQuestions"> }
  testCases: DocInsert<"programmingQuestionTestCases">[]
} {
  const questionId = crypto.randomUUID()
  const programmingQuestionId = crypto.randomUUID()

  const numPublicTestCases = 0.4 * args.question.testCases.length

  return {
    questionSlug: slugify(args.question.title),

    question: {
      id: questionId,
      difficulty: args.question.difficulty,
      programming_question_id: programmingQuestionId,
      programmingQuestion: {
        id: programmingQuestionId,
        title: args.question.title,
        description: args.question.description,
        starterCode: args.question.starterCode,
        source_id: args.source_id,
      },
    },

    testCases: args.question.testCases.flatMap(
      (testCase, index): DocInsert<"programmingQuestionTestCases"> => ({
        id: crypto.randomUUID(),
        programming_question_id: programmingQuestionId,
        args: testCase.args,
        expectedOutput: testCase.expectedOutput,
        type: index < numPublicTestCases ? "public" : "hidden",
      }),
    ),
  }
}

async function getExistingQuestionSlugs() {
  const allQuestions = await db.query.questions.findMany({
    columns: {},

    with: {
      programmingQuestion: {
        columns: {
          title: true,
        },
      },
    },
  })

  const slugs = allQuestions.map((q) => slugify(q.programmingQuestion?.title ?? ""))

  return new Set(slugs)
}

async function main() {
  const file = process.argv[2]

  if (!file) {
    throw new Error("No file specified")
  }

  const rawData = await readFile(file, { encoding: "utf-8" })
  const newQuestionInputs = await QuestionJSONFileSchema.parseAsync(JSON.parse(rawData))

  const source = await db.query.programmingQuestionSources.findFirst({
    where: cmp.eq(schema.programmingQuestionSources.type, "ai"),
  })
  invariant(source, "No AI source found")

  const existingQuestionSlugs = await getExistingQuestionSlugs()

  const dbDocuments = newQuestionInputs
    .map((question) => getDbDocuments({ question, source_id: source.id }))
    .filter((q) => {
      if (existingQuestionSlugs.has(q.questionSlug)) {
        console.log(
          `Skipping ${q.question.programmingQuestion.title} because it probably already exists`,
        )
        return false
      }

      existingQuestionSlugs.add(q.questionSlug)
      return true
    })

  if (!dbDocuments.length) {
    console.log("\n\nNo new questions to insert\n\n")
    return
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.programmingQuestions)
      .values(dbDocuments.map(({ question }) => question.programmingQuestion))
    await tx.insert(schema.questions).values(dbDocuments.map(({ question }) => question))
    await tx
      .insert(schema.programmingQuestionTestCases)
      .values(dbDocuments.flatMap(({ testCases }) => testCases))
  })
}

void main()
  .catch((e) => {
    console.error("FAILED", e)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
