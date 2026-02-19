import z from "zod";

type ParamType<T> = T extends `${infer NAME}_PARAM_NAME`
  ? `${NAME}_PARAM_NAME`
  : never;

const jim: ParamType<"USERPOOL_ID_PARAM_NAME"> = "USERPOOL_ID_PARAM_NAME";

export function schemaBuilder() {
  const schema = z.object({});
  const builder = {
    param(name: ParamType<infer T>) {
      schema.extend({ [name]: z.string().min(1) });
      return builder;
    },

    featureFlag<T extends `${string}_FEATURE_FLAG`>(name: T) {
      schema.extend({ [name]: z.string().min(1) });
      return builder;
    },

    secret<T extends `${string}_SECRET`>(name: T) {
      schema.extend({ [name]: z.string().min(1) });
      return builder;
    },
    build() {
      return schema;
    },
  };

  return builder;
}

const schema = schemaBuilder()
  .param("USERPOOL_ID_PARAM_NAME")
  .param("CLIENT_ID_PARAM_NAME")
  .featureFlag("NEW_FEATURE_FEATURE_FLAG")
  .secret("SOME_SECRET")
  .build();

export type Config = z.infer<typeof schema>;
