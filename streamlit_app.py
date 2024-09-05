import streamlit as st
from pyvis.network import Network
import streamlit as st
import pandas as pd
import networkx 
import streamlit.components.v1 as components


st.title("F      U      L      B      O      O")
st.write("beta")

fulbodata = ''

countries = ['Spain', 'England', 'Germany']
country = st.selectbox("Select a league:", countries)

if country == 'England':
    fulbodata = pd.read_csv('SP1.csv')
if country == 'Spain':
    fulbodata = pd.read_csv('SP1.csv')
if country == 'Germany':
    fulbodata = pd.read_csv('SP1.csv')

# pandas -> networkx
G = networkx.DiGraph()

for _, row in fulbodata.iterrows():
    source = row['HomeTeam']
    target = row['AwayTeam']
    result = row['FTR']  

    if result == 'H' and not (G.has_edge(source, target) or G.has_edge(target, source)):
        G.add_edge(source, target, label='')
    elif result == 'A' and not (G.has_edge(source, target) or G.has_edge(target, source)):
        G.add_edge(target, source, label='')
    elif result == 'D' and not (G.has_edge(source, target) or G.has_edge(target, source)):
        G.add_edge(source, target, label=' ')

# node customization
for node in G.nodes():
    G.nodes[node]['label'] = str(node)
    G.nodes[node]['color'] = '#e3cfac'
    G.nodes[node]['labelHighlightBold'] = False

# networkx -> pyvis
visualizer = Network(height = '610px', width = '110%', bgcolor = '#090812', font_color = 'white', directed=True, neighborhood_highlight=False)
visualizer.from_nx(G)
visualizer.set_edge_smooth("dynamic")

visualizer.repulsion(
    node_distance=300,
    central_gravity=0,
    spring_length=10,
    spring_strength=0.10,
    damping=0.3
)

# it's searching time
teams = list(G.nodes)
count_teams = len(teams)
team_name = st.selectbox("Select a team:", teams)

if team_name:
    score = 0
    for edge in visualizer.edges:
        if edge['label'] == ' ' and (edge['from'] == team_name or edge['to'] == team_name):
            edge['color'] = '#aaaaaa'
            edge['width'] = 2
        elif edge['from'] == team_name:
            edge['color'] = '#92db8a'
            edge['width'] = 2
            score += 1
        elif edge['to'] == team_name:
            edge['color'] = '#db918a'
            edge['width'] = 2
            score -= 1
    normalized_score = (score + 20) / 40
    pastel_red = (219, 145, 138)  
    pastel_green = (146, 219, 138)  
    red = int((1 - normalized_score) * pastel_red[0] + normalized_score * pastel_green[0])
    green = int((1 - normalized_score) * pastel_red[1] + normalized_score * pastel_green[1])
    blue = int((1 - normalized_score) * pastel_red[2] + normalized_score * pastel_green[2])

    visualizer.get_node(team_name)['color'] = f'#{red:02X}{green:02X}{blue:02X}'
    visualizer.get_node(team_name)['size'] = 20

visualizer.save_graph('pyvis_graph.html')

with open('pyvis_graph.html', 'r') as f:
    raw_html = f.read()

raw_html = raw_html.replace(
    "#mynetwork {", 
    "#mynetwork { top: -15px; left: -5px; margin: 0; width: 120%; height: 100%;"
)
with st.spinner('Loading HTML content...'):
    components.html(raw_html, height=600, scrolling=False)
