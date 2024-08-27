import streamlit as st
from pyvis.network import Network
import streamlit as st
import pandas as pd
import networkx 
import streamlit.components.v1 as components
import base64


st.title("F    U    L    B    O")

fulbodata = pd.read_csv('SP1.csv')

# pandas -> networkx
G = networkx.from_pandas_edgelist(fulbodata, 'HomeTeam', 'AwayTeam', 'FTR')
for node in G.nodes():
    G.nodes[node]['label'] = str(node)
    G.nodes[node]['color'] = '#e3cfac'

# networkx -> pyvis
visualizer = Network(height = '600px', bgcolor = '#090812')
#visualizer.add_node("hi", label="hi", color = 'blue')
visualizer.from_nx(G)

visualizer.repulsion(
    node_distance=500,
    central_gravity=0,
    spring_length=10,
    spring_strength=0.10,
    damping=0.3
)

visualizer.save_graph('pyvis_graph.html')

with open('pyvis_graph.html', 'r') as f:
    raw_html = f.read()
components.html(raw_html, height=600, scrolling=True)