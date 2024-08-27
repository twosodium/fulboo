import streamlit as st
import networkx as nx
import pandas as pd

st.title("FULBO")

fulbodata = pd.read_csv('SP1.csv')

# pandas -> networkx
G = nx.from_pandas_edgelist(fulbodata, 'HomeTeam', 'AwayTeam', 'FTR')
for node in G.nodes():
    G.nodes[node]['label'] = str(node)

pydot_graph = nx.nx_pydot.to_pydot(G)

graphviz_str = pydot_graph.to_string()

st.graphviz_chart(graphviz_str)