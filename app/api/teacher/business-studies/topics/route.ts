import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import {
  getSubjectConfigurationByDatabaseId,
} from "@/lib/subjects/subjectConfig";

type TopicRow = {
  id: string;
  title: string;
};

function normaliseTopicTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

function matchingTopic(topics: TopicRow[], title: string) {
  const normalisedTitle = title.toLocaleLowerCase("en");
  return topics.find(
    (topic) => topic.title.toLocaleLowerCase("en") === normalisedTitle,
  );
}

function getSupportedSubjectId(value: unknown) {
  return typeof value === "string" &&
    getSubjectConfigurationByDatabaseId(value)
    ? value
    : null;
}

export async function GET(request: Request) {
  try {
    const subjectId = getSupportedSubjectId(
      new URL(request.url).searchParams.get("subjectId"),
    );
    if (!subjectId) {
      return Response.json(
        { error: "A supported subject is required.", code: "INVALID_SUBJECT" },
        { status: 400 },
      );
    }
    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }

    const { data, error } = await authorization.teacher.admin
      .from("subject_topics")
      .select("id, title")
      .eq("subject_id", subjectId)
      .order("title", { ascending: true });

    if (error) throw error;
    return Response.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("Subject topic read failed:", error);
    return Response.json(
      { error: "Unable to load lesson topics.", code: "TOPIC_READ_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Malformed JSON request body.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const record =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const subjectId = getSupportedSubjectId(record?.subjectId);
    if (!subjectId) {
      return Response.json(
        { error: "A supported subject is required.", code: "INVALID_SUBJECT" },
        { status: 400 },
      );
    }
    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }
    const requestedTitle =
      record?.title;
    if (typeof requestedTitle !== "string") {
      return Response.json(
        { error: "Enter a topic title.", code: "INVALID_TOPIC" },
        { status: 400 },
      );
    }

    const title = normaliseTopicTitle(requestedTitle);
    if (!title || title.length > 200) {
      return Response.json(
        {
          error: title ? "Topic titles must be 200 characters or fewer." : "Enter a topic title.",
          code: "INVALID_TOPIC",
        },
        { status: 400 },
      );
    }

    const { admin } = authorization.teacher;
    const { data: topics, error: topicsError } = await admin
      .from("subject_topics")
      .select("id, title")
      .eq("subject_id", subjectId);

    if (topicsError) throw topicsError;
    const existingTopic = matchingTopic((topics ?? []) as TopicRow[], title);
    if (existingTopic) {
      return Response.json({ success: true, data: existingTopic });
    }

    const { data, error } = await admin
      .from("subject_topics")
      .insert({
        subject_id: subjectId,
        title,
      })
      .select("id, title")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: concurrentTopics, error: concurrentTopicsError } =
          await admin
            .from("subject_topics")
            .select("id, title")
            .eq("subject_id", subjectId);
        if (concurrentTopicsError) throw concurrentTopicsError;
        const concurrentTopic = matchingTopic(
          (concurrentTopics ?? []) as TopicRow[],
          title,
        );
        if (concurrentTopic) {
          return Response.json({ success: true, data: concurrentTopic });
        }
      }
      throw error;
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Subject topic creation failed:", error);
    return Response.json(
      {
        error: "The lesson topic could not be created. Please try again.",
        code: "TOPIC_CREATE_FAILED",
      },
      { status: 500 },
    );
  }
}
