type Response = { data: any; error: any };
type ResponseMap = Record<string, Response | Response[]>;

type QueryState = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: any;
  filters?: { type: string; args: any[] }[];
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
      _addFilter: (type: string, args: any[]) => {
        state.filters = state.filters || [];
        state.filters.push({ type, args });
        return chain;
      },
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
      eq: (...args: any[]) => chain._addFilter("eq", args),
      match: (...args: any[]) => chain._addFilter("match", args),
      or: (...args: any[]) => chain._addFilter("or", args),
      in: (...args: any[]) => chain._addFilter("in", args),
      neq: (...args: any[]) => chain._addFilter("neq", args),
      is: (...args: any[]) => chain._addFilter("is", args),
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
