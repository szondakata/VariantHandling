!INC Local Scripts.EAConstants-JScript

/*
 * Script Name: Generate Variant System
 * Author: Katalin Szonda
 * Date: 2024.04.28.
 */

var diagram as EA.Diagram;
var configDiagram as EA.Diagram;
var metaBlockParentPackage as EA.Package;
var diagramPackage as EA.Package;

var configDiagramElements as EA.Collection;

var configBlockElement as EA.Element;
var metaBlockElement as EA.Element;
var variationPointIDs = [];
var variationIDs = [];
var configurationSetElementIDs = [];

function OnProjectBrowserScript(){
	// Find meta IBD: Get the type of element selected in the Project Browser
	var treeSelectedType = Repository.GetTreeSelectedItemType();
	
	switch (treeSelectedType){
		case otDiagram :
		{
			//Code for when a diagram is selected
			configDiagram = Repository.GetTreeSelectedObject();
			diagramPackageID = configDiagram.PackageID;

			//Find config block, and the configured variants
			FindConfigBlock();					/// configBlockElement
			FindConfigurationSet();				/// configurationSetElementIDs (Modules)
		
			//Find meta block and its package
			FindMetaBlock();					/// metaBlockElement
			
			//Copy metablock and IBD
			CopyMetaBlock();
			
			//Find variation point typed properties within the copied block
			
			break;
		}
		default:
		{
			// Error message
			Session.Prompt( "This script only supports diagram item type.", promptOK );
			return;
		}
	}	
}

//Finding the config block on the diagram.
function FindConfigBlock(){
	var diagramObject as EA.DiagramObject;
	var element as EA.Element;
	for (var i = 0; i < configDiagram.DiagramObjects.Count; i++){
		diagramObject = configDiagram.DiagramObjects.GetAt(i);
		element = Repository.GetElementByID(diagramObject.ElementID);
		if(element.Stereotype.indexOf("VariantConfiguration") != -1){
			configBlockElement = element;
			Session.Output("Configuration Block found: " + configBlockElement.ElementGUID);
			break;
		}
	}
	
	if(configBlockElement == null){
		Session.Prompt( "Configuration Block not found on diagram!", promptOK );
		return;
	}
}

function FindConfigurationSet(){
	var connector as EA.Connector;
	var element as EA.Element;
	for (var j = 0; j < configBlockElement.Connectors.Count; j++){
		connector = configBlockElement.Connectors.GetAt(j);
		//Generalization
		if(connector.Type == "Aggregation"){
			configurationSetElementIDs.push(connector.ClientID);
			element = Repository.GetElementByID(connector.ClientID);
			Session.Output("Configured " + connector.ClientEnd.Role + " element: «" + element.Stereotype + "» " + element.Name + " " + element.ElementGUID);
		}
	}
}

function FindMetaBlock(){
	var connector as EA.Connector;
	for (var j = 0; j < configBlockElement.Connectors.Count; j++){
		connector = configBlockElement.Connectors.GetAt(j);
		//Generalization
		if(connector.Type == "Generalization"){
			metaBlockElement = Repository.GetElementByID(connector.SupplierID);
			metaBlockParentPackage = Repository.GetPackageByID(metaBlockElement.PackageID);
			Session.Output("System block: " + metaBlockElement.ElementGUID);
		}
	}
	
	if(metaBlockElement == null){
		Session.Prompt( "Meta Block not found!", promptOK );
		return;
	}
}

function CopyMetaBlock(){
	var packages as EA.Collection;
	var configBlockPackage as EA.Package;
	var clonedPackage as EA.Package;
	var copyPackage as EA.Package;
	var copiedBlock as EA.Element;
	var systemVariantBlockConnectors as EA.Collection;
	
	///Create dummy package
	packages = metaBlockParentPackage.Packages;
	copyPackage = packages.AddNew( "CopyPackage", "Class" );
	copyPackage.Update();
	packages.Refresh();
	
	//Move package to the dummy package for package deep clone
	metaBlockElement.PackageID = copyPackage.PackageID;
	metaBlockElement.Update();
	
	//Clone dummy package
	clonedPackage = copyPackage.Clone();
	
	//Put package back to its original place
	metaBlockElement.PackageID = metaBlockParentPackage.PackageID;
	metaBlockElement.Update();
	
	//Move deep copy next to the config block
	clonedPackage.ParentID = diagramPackageID;
	clonedPackage.Name = configBlockElement.Name + " system";
	clonedPackage.Update();
	
	//Delete dummy package
	for(var i = 0; i < packages.Count; i++){
		if(packages.GetAt(i).PackageID == copyPackage.PackageID){
			packages.Delete(i);
			packages.Refresh();
			metaBlockParentPackage.Packages.Refresh();
		}
	}

	//Find copied block
	for(var i = 0; i < clonedPackage.Elements.Count; i++){
		element = clonedPackage.Elements.GetAt(i);
		
		if(element.Stereotype == "block" || element.Stereotype == "Variation"){
			copiedBlock = clonedPackage.Elements.GetAt(i)
			copiedBlock.Name = configBlockElement.Name + " system";
			copiedBlock.Update();
			systemVariantBlockConnectors = copiedBlock.Connectors;
			
			Session.Output("Copied block: " + copiedBlock.ElementGUID);
		}
	}
	
	var configurationSetElement as EA.Element;
	var connectors as EA.Collection;
	var generalization as EA.Connector;
	var variationElement as EA.Element;
	for (var j = 0; j < configurationSetElementIDs.length; j++){
		//For every configurated Variant(configurationSetElement)
		configurationSetElement = Repository.GetElementByID(configurationSetElementIDs[j]);
		connectors = configurationSetElement.Connectors;
		
		
		for (i = 0; i < connectors.Count; i++){
			//Find the Generalized variation(variationElement)
			if(connectors.GetAt(i).ClientID == configurationSetElement.ElementID && connectors.GetAt(i).Type.indexOf("Generalization") != -1 && Repository.GetElementByID(connectors.GetAt(i).SupplierID).Stereotype.indexOf("Variation") != -1){
				generalization = connectors.GetAt(i);
				//Variation(Component):
				variationElement = Repository.GetElementByID(generalization.SupplierID);
				Session.Output("Variation (from component): " + variationElement.Name + " " + variationElement.ElementGUID);
				//variant:
				Session.Output("Variant: " + configurationSetElement.Name + " " + configurationSetElement.ElementGUID);
					
				// If a variation - variant match is found, find the matching variationpoint parts in the copied structure
				for (var k = 0; k < copiedBlock.Elements.Count; k++){
					//Part on IBD
					element = copiedBlock.Elements.GetAt(k);
					if (Repository.GetElementByID(element.PropertyType).Stereotype.indexOf("VariationPoint") != -1){
						//Connected variationPoint to the part
						var variationPointElement as EA.Element;
						var variation as EA.Element;
						variationPointElement = Repository.GetElementByID(element.PropertyType);

						
						// Variation (From VariationPoint):
						variation = Repository.GetElementByGuid(variationPointElement.TaggedValues.GetByName("variation").Value);
						Session.Output("Variation (from VariationPoint): " + variation.Name + " (" + Repository.GetPackageByID(variation.PackageID).Name + ") «" + variation.Stereotype + "» " + variation.ElementGUID);
						
						if(element.Name == ""){
							if(variation.ElementGUID == variationElement.ElementGUID){
								element.PropertyType = configurationSetElement.ElementID;
								element.Update();
								
								
								for(y = 0; y < systemVariantBlockConnectors.Count; y++){
									var ctr as EA.Connector;
									ctr = systemVariantBlockConnectors.GetAt(y);
									if(ctr.Type == "Aggregation" && ctr.SupplierID == copiedBlock.ElementID && ctr.ClientID == variationPointElement.ElementID && ctr.ClientEnd.Role == element.Name){
										ctr.ClientID = configurationSetElement.ElementID;
										ctr.Update();
									}
								}
							}
						} else {
							//If the part has a name,
							var aggregationWithRole as EA.Connector;
							var elementConnectors as EA.Collection;
							for(x = 0; x < connectors.Count; x++){
								aggregationWithRole = connectors.GetAt(x);
								
								//Check if the configurationset has the name as role
								if(aggregationWithRole.Type == "Aggregation" && aggregationWithRole.ClientEnd.Role == element.Name){
									//Check if the varaitions match from variationpoint and variant side
									if(variation.ElementGUID == variationElement.ElementGUID){
										element.PropertyType = configurationSetElement.ElementID;
										element.Update();
										
										Session.Output(configurationSetElement.Name + " " + configurationSetElement.ElementGUID + " " + element.Name);
										
										
										for(y = 0; y < systemVariantBlockConnectors.Count; y++){
											var ctr as EA.Connector;
											ctr = systemVariantBlockConnectors.GetAt(y);
											if(ctr.Type == "Aggregation" && ctr.SupplierID == copiedBlock.ElementID && ctr.ClientID == variationPointElement.ElementID && ctr.ClientEnd.Role == element.Name){
												ctr.ClientID = configurationSetElement.ElementID;
												ctr.Update();
											}
										}
									}
								}
							}
						}
					} 
				}
			}
		}
	}
	
	for(var i = 0; i < copiedBlock.Diagrams.Count; i++){
		copiedBlock.Diagrams.GetAt(i).Update();
	}
}

OnProjectBrowserScript();
