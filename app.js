"use strict";

document.addEventListener('DOMContentLoaded', function() {
  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),
    layout: {
      name: 'cose-bilkent',
      animate: false,
      randomize: true
    },
    style: [ // the stylesheet for the graph
      {
        selector: 'node[label="Person"]',
        style: {
          'background-color': '#28a745',
          'label': 'data(name)'
        }
      },
      {
        selector: 'node[label="Movie"]',
        style: {
          'background-color': '#dc3545',
          'label': 'data(title)'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle'
        }
      }
    ]
  });

  registerContextMenus();

  var concentricOptions = {
    name: 'concentric',
    concentric: function(node) {
      return 10 - node.data('level');
    },
    levelWidth: function() {
      return 1;
    },
    animate: false
  };


  var url = 'bolt://localhost';
  var user = 'neo4j';
  var pass = '1234';
  window.neo4jdriver = neo4j.v1.driver(url, neo4j.v1.auth.basic(user, pass));
  var session = window.neo4jdriver.session();

  function addMain(name, maxLevel){
  session
    .run(`MATCH (p {name: "${name}"}) RETURN p`)
    .then(function(result){
      result.records.forEach(function(record){
        console.log(record._fields[0]);
        var level = 1;
        cy.add(actorToCyEle(record._fields[0],0));
        if(maxLevel>0)
          addCoActor(level, name, record, maxLevel);
      })
    })
    .catch(function(err){
      console.log(err);
    });
  }

  function addCoActor(level, name, target, maxLevel){
    session
      .run(`MATCH (p:Person {name: "${name}"})-[:ACTED_IN]->(movies) RETURN movies`)
      .then(function(result){
        result.records.forEach(function(record){
          if (cy.getElementById(record._fields[0].identity.low).empty()) {
            console.log(record._fields[0]);
            var title = record._fields[0].properties.title;
            cy.add(movieToCyEle(record._fields[0],level));
            cy.add({
              data: {
                id: 'edge' + record._fields[0].identity.low + target._fields[0].identity.low ,
                  source: record._fields[0].identity.low,
                  target: target._fields[0].identity.low
              },
            selectable: false
            });
            session.run(`MATCH (mov:Movie {title: "${title}"})<-[:ACTED_IN]-(acts) RETURN acts`)
            .then(function(result){
              result.records.forEach(function(record0){
                if (cy.getElementById(record0._fields[0].identity.low).empty()){
                  console.log(record0._fields[0]);
                  cy.add(actorToCyEle(record0._fields[0],level+1));
                }
                if(cy.getElementById('edge' + record0._fields[0].identity.low + record._fields[0].identity.low).empty()){
                  cy.add({
                      data: {
                        id: 'edge' + record0._fields[0].identity.low + record._fields[0].identity.low,
                          source: record0._fields[0].identity.low,
                          target: record._fields[0].identity.low
                      },
                    selectable: false
                  });
                }
                if(level < maxLevel * 2 -1){
                  addCoActor(level+2, record0._fields[0].properties.name, record0, maxLevel);
                }
              }) 
            });
          }
        })
      })
      .catch(function(err){
        console.log(err);
      });
  }

  function addNeighbors(node, level){
    var matchQuery;
    if (node._private.data.label == "Person"){ 
      matchQuery = `MATCH (p:Person {name: "${node._private.data.name}"})-[:ACTED_IN]->(movies) RETURN movies`;
    } 
    else{
      matchQuery = `MATCH (mov:Movie {title: "${node._private.data.title}"})<-[:ACTED_IN]-(acts) RETURN acts`;
    }
    session
    .run(matchQuery)
    .then(function(result){
      result.records.forEach(function(record){
        console.log(record);
        console.log(record._fields[0].labels);
        if (cy.getElementById(record._fields[0].identity.low).empty()) {
          console.log('lebel' + record._fields[0].labels);
          if(record._fields[0].labels == "Person"){
            console.log('control1');
            cy.add(actorToCyEle(record._fields[0],level+1));
          }
          else{
            console.log('control1');
            cy.add(movieToCyEle(record._fields[0],level+1));
          }
          if(cy.getElementById('edge' + record._fields[0].identity.low).empty() + node._private.data.id ){
            console.log('try1');
            cy.add({
                data: {
                  id: 'edge' + record._fields[0].identity.low + node._private.data.id,
                    source: record._fields[0].identity.low,
                    target: node._private.data.id
                },
              selectable: false
            });
          }
        }
        console.log(node._private.data.id);

        
      })
    })
    .catch(function(err){
      console.log(err);
    });

  }

  var concentricButton = document.getElementById('concentricButton');
  concentricButton.addEventListener('click', function() {
    // var layout = cy.layout({
    //   name: 'cose-bilkent',
    //   animate: 'end',
    //   animationEasing: 'ease-out',
    //   animationDuration: 2000,
    //   randomize: true
    // });
    //   layout.run();
    cy.layout(concentricOptions);
  });

  var coseButton = document.getElementById('coseButton');
  coseButton.addEventListener('click', function() {
    var layout = cy.layout({
      name: 'cose-bilkent',
      animate: 'end',
      animationEasing: 'ease-out',
      animationDuration: 2000,
      randomize: true
    });
      layout.run();
    //cy.layout(concentricOptions);
  });

  var submitButton = document.getElementById('submitButton');
  submitButton.addEventListener('click', function() {
    cy.elements().remove();
    var userInput = document.getElementById('actName').value;
    var level = document.getElementById('number').value;
    addMain(userInput, level);
  });

  function registerContextMenus() {
    window.cy.contextMenus({
      menuItems: [
        {
          id: 'showMoviesOfPerson',
          content: 'show movies of person',
          tooltipText: 'show movies of person',
          selector: 'node[label="Person"]',
          onClickFunction: function (event) {
            var target = event.target || event.cyTarget;
            console.log('target: ', target);
            addNeighbors(target, target._private.data.level);
          }
        },
        {
          id: 'showActorsOfMovie',
          content: 'show actors of movie',
          tooltipText: 'show actors of movie',
          selector: 'node[label="Movie"]',
          onClickFunction: function (event) {
            var target = event.target || event.cyTarget;
            console.log('target: ', target);
            addNeighbors(target, target._private.data.level);
          }
        }
      ]
    });
  }

});



function actorToCyEle(user, level) {
  return {
    data: {
      id: user.identity.low,
      name: user.properties.name,
      born: user.properties.born,
      level: level,
      label: "Person"
    },
    position: {
      // render offscreen
      x: -1000000,
      y: -1000000
    }
  };
}

function edgeToCyEle(sourceid, targetid) {
  return {
    data: {
      id: 'edge' + sourceid.identity.low + targetid.identity.low,
        source: sourceid.identity.low,
        target: targetid.identity.low
    },
    selectable: false
  };
}

function movieToCyEle(movie, level) {
  return {
    data: {
      id: movie.identity.low,
      released: movie.properties.released,
      title: movie.properties.title,
      tagline: movie.properties.tagline,
      level: level,
      label: "Movie"
    },
    position: {
      // render offscreen
      x: -1000000,
      y: -1000000
    }
  };
}
