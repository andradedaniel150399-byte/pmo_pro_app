async function fetchPipeProjects(pipeId) {
  const url = 'https://api.pipefy.com/graphql';
  const headers = { 'Authorization': `Bearer ${PIPEFY_TOKEN}`, 'Content-Type': 'application/json' };

  // 1) Tenta via allCards (recomendado pela API atual)
  let query = `query($pipeId:ID!){
    allCards(pipeId:$pipeId, first:200){
      edges{ node{
        id title createdAt updatedAt
        fields{ name value field { id label internal_id } }
      } }
    }
  }`;
  let body = JSON.stringify({ query, variables: { pipeId } });
  let r = await fetch(url, { method: 'POST', headers, body });
  let json = await r.json();

  // Se deu erro (ex.: permissão) ou não veio dado, cai no fallback por fases
  if (!r.ok || json.errors || !json?.data?.allCards) {
    query = `query($id:ID!){
      pipe(id:$id){
        id name
        phases{
          name
          cards(first:200){
            edges{ node{
              id title createdAt updatedAt
              fields{ name value field { id label internal_id } }
            } }
          }
        }
      }
    }`;
    body = JSON.stringify({ query, variables: { id: pipeId } });
    r = await fetch(url, { method: 'POST', headers, body });
    json = await r.json();
    if (json.errors) throw new Error('Pipefy errors (fallback): ' + JSON.stringify(json.errors));

    const edges = (json?.data?.pipe?.phases || [])
      .flatMap(ph => (ph.cards?.edges || []));
    return edges.map(e => {
      const fields = e.node.fields || [];
      const meta = {};
      for (const f of fields) {
        const iid = f?.field?.internal_id;
        if (iid) meta[iid] = f?.value ?? null;
      }
      const look = (iid) => (iid ? (meta[iid] ?? null) : null);
      const status = look(PIPEFY_STATUS_FIELD) || 'imported';
      const owner_email = look(PIPEFY_OWNER_EMAIL_FIELD) || null;
      return {
        external_id: e.node.id,
        name: e.node.title,
        status,
        owner_email,
        meta,
        created_at: e.node.createdAt ? new Date(e.node.createdAt).toISOString() : new Date().toISOString(),
        updated_at: e.node.updatedAt ? new Date(e.node.updatedAt).toISOString() : new Date().toISOString()
      };
    });
  }

  // Sucesso via allCards
  const edges = json.data.allCards.edges || [];
  return edges.map(e => {
    const fields = e.node.fields || [];
    const meta = {};
    for (const f of fields) {
      const iid = f?.field?.internal_id;
      if (iid) meta[iid] = f?.value ?? null;
    }
    const look = (iid) => (iid ? (meta[iid] ?? null) : null);
    const status = look(PIPEFY_STATUS_FIELD) || 'imported';
    const owner_email = look(PIPEFY_OWNER_EMAIL_FIELD) || null;
    return {
      external_id: e.node.id,
      name: e.node.title,
      status,
      owner_email,
      meta,
      created_at: e.node.createdAt ? new Date(e.node.createdAt).toISOString() : new Date().toISOString(),
      updated_at: e.node.updatedAt ? new Date(e.node.updatedAt).toISOString() : new Date().toISOString()
    };
  });
}
