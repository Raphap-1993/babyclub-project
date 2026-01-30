type Response = { data: any; error: any };
type ResponseMap = Record<string, Response | Response[]>;

type QueryState = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: any;
};

const defaultResponse: Response = { data: null, error: null };

function nextResponse(map: ResponseMap, key: string): Response {
  const value = map[key];
  if (Array.isArray(value)) {
    return (value.shift() as Response) || defaultResponse;
  }
  return (value as Response) || defaultResponse;
}

export function createSupabaseMock(responses: ResponseMap) {
  const calls: QueryState[] = [];

  const makeChain = (state: QueryState) => {
    const chain: any = {
      select: () => {
        if (!["insert", "update", "delete"].includes(state.op)) {
          state.op = "select";
        }
        return chain;
      },
      insert: (payload: any) => {
        state.op = "insert";
        state.payload = payload;
        return chain;
      },
      update: (payload: any) => {
        state.op = "update";
        state.payload = payload;
        return chain;
      },
      delete: () => {
        state.op = "delete";
        return chain;
      },
      eq: () => chain,
      match: () => chain,
      or: () => chain,
      in: () => chain,
      neq: () => chain,
      limit: () => chain,
      order: () => chain,
      maybeSingle: () => {
        calls.push({ ...state });
        return Promise.resolve(nextResponse(responses, `${state.table}.${state.op}`));
      },
      single: () => {
        calls.push({ ...state });
        return Promise.resolve(nextResponse(responses, `${state.table}.${state.op}`));
      },
    };

    chain.then = (resolve: any, reject: any) => {
      calls.push({ ...state });
      return Promise.resolve(nextResponse(responses, `${state.table}.${state.op}`)).then(resolve, reject);
    };

    return chain;
  };

  return {
    supabase: {
      from: (table: string) => makeChain({ table, op: "select" }),
    },
    calls,
  };
}
