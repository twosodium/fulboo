import streamlit as st
import pandas as pd
from streamlit_agraph import agraph, Node, Edge, Config
import random

st.title("F    U    L    B    O")

fulbodata = pd.read_csv('SP1.csv')

nodes = []
edges = []

for index, row in fulbodata.iterrows():
    home_team = row['HomeTeam']
    away_team = row['AwayTeam']
    ftr = row['FTR']
    
    if home_team not in [node.id for node in nodes]:
        nodes.append(Node(id=home_team, label=home_team, size=20, color = "#"+''.join([random.choice('0123456789ABCDEF') for j in range(6)]), font={'color': 'white'}))
    if away_team not in [node.id for node in nodes]:
        nodes.append(Node(id=away_team, label=away_team, size=20, color="#"+''.join([random.choice('0123456789ABCDEF') for j in range(6)]), font={'color': 'white'}))
    
    edges.append(Edge(source=home_team, target=away_team, label=ftr))

config = Config(width='100%', 
                height=500, 
                directed=True, 
                nodeHighlightBehavior=True, 
                collapsible=True)

agraph(nodes=nodes, 
       edges=edges, 
       config=config)