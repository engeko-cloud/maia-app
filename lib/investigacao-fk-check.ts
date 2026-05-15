/** Returns the SQL + params for "is this categoria referenced by any investigacao?" */
export function buildCategoriaInUseQuery(categoriaId: string) {
  return {
    sql: `
      select 1 from investigacoes
       where dados -> 'ishikawa' @> jsonb_build_array(jsonb_build_object('categoria_id', $1::text))
       limit 1
    `,
    params: [categoriaId],
  };
}

/** Returns the SQL + params for "is this grau referenced by any investigacao?" */
export function buildGrauInUseQuery(grauId: string) {
  return {
    sql: `
      select 1 from investigacoes
       where dados -> 'ishikawa' @> jsonb_build_array(jsonb_build_object('grau_id', $1::text))
       limit 1
    `,
    params: [grauId],
  };
}

/** Returns the SQL + params for "is this causa referenced by any investigacao?" */
export function buildCausaInUseQuery(causaId: string) {
  return {
    sql: `
      select 1 from investigacoes
       where dados -> 'ishikawa' @> jsonb_build_array(jsonb_build_object('causa_id', $1::text))
       limit 1
    `,
    params: [causaId],
  };
}
